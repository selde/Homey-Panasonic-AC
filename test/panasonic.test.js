'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MODE,
  FAN,
  MIN_TEMP,
  MAX_TEMP,
  buildState,
  buildProntoHex,
  decodeProntoHexToState,
  buildBroadlinkPacket,
  decodeState,
} = require('../lib/panasonic-jke');

// Exact 27-byte JKE frame confirmed on a real Panasonic JKE unit:
// HEAT / 22C / MED / ON.
const VERIFIED_HEAT_22_MED = [
  0x02, 0x20, 0xE0, 0x04, 0x00, 0x00, 0x00, 0x06, 0x02,
  0x20, 0xE0, 0x04, 0x00, 0x41, 0x2C, 0x80, 0x50, 0x00,
  0x00, 0x0E, 0xE0, 0x00, 0x00, 0x81, 0x00, 0x00, 0xB2,
];

test('encoder reproduces the hardware-verified HEAT/22/MED frame', () => {
  const state = buildState({
    power: true,
    mode: MODE.HEAT,
    temp: 22,
    fan: FAN.MED,
  });

  assert.deepEqual(state, VERIFIED_HEAT_22_MED);
});

test('verified JKE frame decodes to the expected state', () => {
  const decoded = decodeState(
    VERIFIED_HEAT_22_MED,
  );

  assert.equal(decoded.power, true);
  assert.equal(decoded.mode, MODE.HEAT);
  assert.equal(decoded.temp, 22);
  assert.equal(decoded.fan, FAN.MED);
  assert.equal(decoded.checksumOk, true);
});

test('temperature clamps to the 16-30C operating range', () => {
  const low = decodeState(
    buildState({
      power: true,
      mode: MODE.HEAT,
      temp: MIN_TEMP - 10,
      fan: FAN.AUTO,
    }),
  );

  const high = decodeState(
    buildState({
      power: true,
      mode: MODE.COOL,
      temp: MAX_TEMP + 10,
      fan: FAN.AUTO,
    }),
  );

  assert.equal(low.temp, MIN_TEMP);
  assert.equal(high.temp, MAX_TEMP);
});

test('fan-only mode uses the fixed 27C temperature', () => {
  const decoded = decodeState(
    buildState({
      power: true,
      mode: MODE.FAN,
      temp: 16,
      fan: FAN.HIGH,
    }),
  );

  assert.equal(decoded.mode, MODE.FAN);
  assert.equal(decoded.temp, 27);
  assert.equal(decoded.fan, FAN.HIGH);
  assert.equal(decoded.checksumOk, true);
});

test('all supported modes and fan speeds produce valid checksums', () => {
  const modes = [
    MODE.AUTO,
    MODE.DRY,
    MODE.COOL,
    MODE.HEAT,
    MODE.FAN,
  ];

  const fans = [
    FAN.AUTO,
    FAN.MIN,
    FAN.LOW,
    FAN.MED,
    FAN.HIGH,
    FAN.MAX,
  ];

  for (const mode of modes) {
    for (const fan of fans) {
      const state = buildState({
        power: true,
        mode,
        temp: 22,
        fan,
      });

      assert.equal(state.length, 27);
      assert.equal(
        decodeState(state).checksumOk,
        true,
        `bad checksum for mode=${mode}, fan=${fan}`,
      );
    }
  }
});

test('Pronto encoding round-trips the JKE state', () => {
  const state = buildState({
    power: true,
    mode: MODE.HEAT,
    temp: 22,
    fan: FAN.MED,
  });

  const decoded = decodeProntoHexToState(buildProntoHex({
    power: true,
    mode: MODE.HEAT,
    temp: 22,
    fan: FAN.MED,
  }));

  assert.equal(decoded.power, true);
  assert.equal(decoded.mode, MODE.HEAT);
  assert.equal(decoded.temp, 22);
  assert.equal(decoded.fan, FAN.MED);
  assert.equal(decoded.checksumOk, true);

  assert.deepEqual(
    buildState({
      power: true,
      mode: MODE.HEAT,
      temp: 22,
      fan: FAN.MED,
    }),
    state,
  );
});

test('Broadlink builder returns a valid raw IR packet', () => {
  const packet = buildBroadlinkPacket({
    power: true,
    mode: MODE.HEAT,
    temp: 22,
    fan: FAN.MED,
  });

  assert.ok(Buffer.isBuffer(packet));
  assert.equal(packet[0], 0x26);
  assert.equal(packet[1], 0x00);

  const payloadLength = packet[2] | (packet[3] << 8);

  assert.equal(packet.length, payloadLength + 4);
  assert.ok(payloadLength > 0);
});
