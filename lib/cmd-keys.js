'use strict';

const {
  MODE, FAN, MIN_TEMP, MAX_TEMP,
} = require('./panasonic-jke');

// Capability values <-> protocol constants.
const MODES = ['auto', 'heat', 'cool', 'dry', 'fan'];
const FANS = ['auto', 'low', 'med', 'high'];

const MODE_MAP = {
  auto: MODE.AUTO,
  heat: MODE.HEAT,
  cool: MODE.COOL,
  dry: MODE.DRY,
  fan: MODE.FAN,
};
const FAN_MAP = {
  auto: FAN.AUTO,
  low: FAN.LOW,
  med: FAN.MED,
  high: FAN.HIGH,
};

const TEMPS = [];
for (let t = MIN_TEMP; t <= MAX_TEMP; t++) TEMPS.push(t);

/**
 * Deterministic command key shared by the signal generator and the device.
 * @param {{power:boolean, mode?:string, temp?:number, fan?:string}} o
 */
function cmdKey({
  power, mode, temp, fan,
}) {
  if (!power) return 'OFF';
  if (mode === 'fan') return `FAN_${fan.toUpperCase()}`;
  return `${mode.toUpperCase()}_${temp}_${fan.toUpperCase()}`;
}

module.exports = {
  MODES, FANS, TEMPS, MODE_MAP, FAN_MAP, cmdKey,
};
