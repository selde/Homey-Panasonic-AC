'use strict';

/*
 * Panasonic JKE IR encoder/decoder.
 *
 * Builds the full 27-byte Panasonic A/C "JKE" state frame and renders it as a
 * Pronto HEX string for Homey's built-in IR blaster
 * (this.homey.rf.getSignalInfrared().cmd()), and decodes such frames back.
 *
 * Verified: sending the state for {power:true, mode:HEAT, temp:22, fan:MED}
 * via a Broadlink RM4 produced a confirmed, repeatable reaction on a real
 * Panasonic JKE-series unit.
 *
 * JKE does not support horizontal swing (unlike DKE) — bytes 17/23/25 use
 * the shared "known good" defaults directly, with no model-specific
 * overrides, matching IRremoteESP8266's setModel(kPanasonicJke) no-op case.
 *
 * -------------------------------------------------------------------------
 * ATTRIBUTION / LICENSE
 * The JKE protocol details (state layout, bit offsets, timing, checksum) are
 * derived from IRremoteESP8266 (src/ir_Panasonic.cpp / .h) by David Conran
 * and contributors, which is licensed under the GNU Lesser General Public
 * License v2.1 (LGPL-2.1). As a derived work, THIS FILE is likewise licensed
 * under LGPL-2.1. See NOTICE and LICENSE.LGPL-2.1 in the repository root.
 *   https://github.com/crankyoldgit/IRremoteESP8266
 * The rest of the app is MIT-licensed; see LICENSE.
 * -------------------------------------------------------------------------
 */

// --- Protocol constants (from ir_Panasonic.h) ---
const KNOWN_GOOD = [
  0x02, 0x20, 0xE0, 0x04, 0x00, 0x00, 0x00, 0x06, 0x02,
  0x20, 0xE0, 0x04, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x0E, 0xE0, 0x00, 0x00, 0x81, 0x00, 0x00, 0x00,
];
const CHECKSUM_INIT = 0xF4;

const MODE = {
  AUTO: 0, DRY: 2, COOL: 3, HEAT: 4, FAN: 6,
};
const FAN = {
  AUTO: 7, MIN: 0, LOW: 1, MED: 2, HIGH: 3, MAX: 4,
};
const FAN_DELTA = 3;

const MIN_TEMP = 16;
const MAX_TEMP = 30;
const FAN_MODE_TEMP = 27; // Fan-only mode carries a fixed temperature of 27C.

// --- IR timing (µs) and carrier (from ir_Panasonic.cpp) ---
const HDR_MARK = 3456;
const HDR_SPACE = 1728;
const BIT_MARK = 432;
const ONE_SPACE = 1296;
const ZERO_SPACE = 432;
const SECTION_GAP = 10000;
const END_GAP = 100000;
const FREQ_HZ = 36700;

// Pronto frequency word and time unit.
const PRONTO_N = Math.round(1000000 / (FREQ_HZ * 0.241246)); // 0x71 for 36.7kHz
const PRONTO_UNIT_US = PRONTO_N * 0.241246;

function setBit(byte, pos, on) {
  const mask = 1 << pos;
  return (on ? byte | mask : byte & ~mask) & 0xFF;
}

function setBits(byte, offset, nbits, data) {
  const mask = 0xFF >> (8 - nbits);
  let b = byte & ~((mask << offset) & 0xFF);
  b |= ((data & mask) << offset) & 0xFF;
  return b & 0xFF;
}

/**
 * Build the 27-byte JKE state frame.
 * @param {object} o
 * @param {boolean} o.power
 * @param {number} o.mode  one of MODE.*
 * @param {number} o.temp  degrees Celsius (clamped 16-30)
 * @param {number} o.fan   one of FAN.*
 * @returns {number[]} 27 bytes including checksum
 */
function buildState({
  power, mode, temp, fan,
}) {
  const s = KNOWN_GOOD.slice();

  // setModel(JKE): common defaults only, no model-specific overrides.
  s[13] &= 0xF0;
  s[17] = 0x00;
  s[21] &= 0b11101111;
  s[23] = 0x81;
  s[25] = 0x00;

  // Power
  s[13] = setBit(s[13], 0, power);

  // Temperature (fan-only mode uses a fixed 27C)
  const t = mode === MODE.FAN
    ? FAN_MODE_TEMP
    : Math.min(Math.max(temp, MIN_TEMP), MAX_TEMP);
  s[14] = setBits(s[14], 1, 5, t);

  // Mode (high nibble, 3 bits)
  s[13] &= 0x0F;
  s[13] = setBits(s[13], 4, 3, mode);

  // Fan speed (high nibble of byte 16)
  s[16] = setBits(s[16], 4, 4, fan + FAN_DELTA);

  // Checksum
  let c = CHECKSUM_INIT;
  for (let i = 0; i < 26; i++) c = (c + s[i]) & 0xFF;
  s[26] = c;

  return s;
}

function buildSection(bytes, trailingGap) {
  const seq = [HDR_MARK, HDR_SPACE];
  for (const byte of bytes) {
    for (let i = 0; i < 8; i++) { // LSB first
      seq.push(BIT_MARK);
      seq.push((byte >> i) & 1 ? ONE_SPACE : ZERO_SPACE);
    }
  }
  seq.push(BIT_MARK, trailingGap); // footer mark + gap
  return seq;
}

/** Convert a 27-byte state to a Pronto HEX string. */
function stateToProntoHex(state) {
  const timing = [
    ...buildSection(state.slice(0, 8), SECTION_GAP),
    ...buildSection(state.slice(8), END_GAP),
  ];
  const words = [0x0000, PRONTO_N, timing.length / 2, 0x0000];
  for (const us of timing) words.push(Math.round(us / PRONTO_UNIT_US));
  return words.map((w) => w.toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

/** Convenience: build a Pronto HEX string directly from settings. */
function buildProntoHex(opts) {
  return stateToProntoHex(buildState(opts));
}

// --- Decoding (inverse of the encoder, used by the test suite) ---

/** Parse a learned Pronto HEX string back into 27 state bytes. */
function decodeProntoHex(hex) {
  const words = hex.trim().split(/\s+/).map((w) => parseInt(w, 16));
  if (words.length < 4 || words[0] !== 0x0000) {
    throw new Error('Not a learned (raw) Pronto HEX string');
  }
  const durations = words.slice(4);
  const midUnits = Math.round(((ONE_SPACE + ZERO_SPACE) / 2) / PRONTO_UNIT_US);

  const bytes = [];
  let i = 0;
  const readSection = (nbytes) => {
    i += 2; // skip header mark + space
    for (let b = 0; b < nbytes; b++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        i += 1; // bit mark
        const space = durations[i];
        i += 1;
        if (space > midUnits) byte |= (1 << bit); // LSB first
      }
      bytes.push(byte);
    }
    i += 2; // skip footer mark + gap
  };
  readSection(8);
  readSection(19);

  if (bytes.length !== 27) {
    throw new Error(`Expected 27 bytes, decoded ${bytes.length}`);
  }
  return bytes;
}

/** Extract logical fields (and checksum validity) from a 27-byte state. */
function decodeState(state) {
  let sum = CHECKSUM_INIT;
  for (let i = 0; i < 26; i++) sum = (sum + state[i]) & 0xFF;
  return {
    power: Boolean(state[13] & 0x1),
    mode: (state[13] >> 4) & 0x7,
    temp: (state[14] >> 1) & 0x1F,
    fan: ((state[16] >> 4) & 0xF) - FAN_DELTA,
    checksumOk: sum === state[26],
  };
}

/** Convenience: decode a Pronto HEX string straight to logical fields. */
function decodeProntoHexToState(hex) {
  return decodeState(decodeProntoHex(hex));
}

/** Convert a 27-byte state to a raw Broadlink IR packet (for RM4 sendData()). */
function stateToBroadlinkPacket(state) {
  const timing = [
    ...buildSection(state.slice(0, 8), SECTION_GAP),
    ...buildSection(state.slice(8), END_GAP),
  ];
  const TICK_US = (269 / 8192) * 1000; // ~32.84 µs per Broadlink-"tick"
  const bytes = [];
  for (const us of timing) {
    const ticks = Math.round(us / TICK_US);
    if (ticks < 256) {
      bytes.push(ticks);
    } else {
      bytes.push(0x00, (ticks >> 8) & 0xFF, ticks & 0xFF);
    }
  }
  if (bytes.length % 2 !== 0) bytes.push(0x00);
  const header = [0x26, 0x00, bytes.length & 0xFF, (bytes.length >> 8) & 0xFF];
  return Buffer.from(header.concat(bytes));
}

/** Convenience: build a raw Broadlink IR packet directly from settings. */
function buildBroadlinkPacket(opts) {
  return stateToBroadlinkPacket(buildState(opts));
}

module.exports = {
  MODE,
  FAN,
  MIN_TEMP,
  MAX_TEMP,
  buildState,
  stateToProntoHex,
  buildProntoHex,
  stateToBroadlinkPacket,
  buildBroadlinkPacket,
  decodeProntoHex,
  decodeProntoHexToState,
  decodeState,
};