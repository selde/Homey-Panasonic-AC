'use strict';

const Homey = require('homey');
const { cmdKey } = require('../../lib/cmd-keys');

const SIGNAL_ID = 'panasonic_dke';
const DEFAULTS = {
  onoff: false,
  target_temperature: 22,
  pana_mode: 'heat',
  pana_fan: 'auto',
};

module.exports = class PanasonicDkeDevice extends Homey.Device {

  async onInit() {
    try {
      this.signal = this.homey.rf.getSignalInfrared(SIGNAL_ID);
    } catch (err) {
      this.error('Failed to acquire IR signal:', err);
    }

    // Migrate devices added before measure_temperature existed.
    if (!this.hasCapability('measure_temperature')) {
      await this.addCapability('measure_temperature').catch(this.error);
    }

    await this._ensureDefaults();

    // Panasonic sends the whole state in one frame, so batch simultaneous
    // capability changes and emit a single IR command.
    this.registerMultipleCapabilityListener(
      ['onoff', 'target_temperature', 'pana_mode', 'pana_fan'],
      (values) => this._onCapabilities(values),
      500,
    );

    this.log('Panasonic CS-E12DKEW device ready');
  }

  async _ensureDefaults() {
    for (const [cap, value] of Object.entries(DEFAULTS)) {
      const current = this.getCapabilityValue(cap);
      if (current === null || current === undefined) {
        await this.setCapabilityValue(cap, value).catch(this.error);
      }
    }
  }

  /**
   * Store a measured value fed in from a Flow. The humidity capability is
   * added on first use so devices only show what the user actually provides.
   */
  async setMeasured(capability, value) {
    if (!this.hasCapability(capability)) {
      await this.addCapability(capability);
    }
    await this.setCapabilityValue(capability, value);
  }

  async _onCapabilities(values) {
    const cur = (cap) => this.getCapabilityValue(cap);

    const power = 'onoff' in values ? values.onoff : cur('onoff');
    const mode = values.pana_mode ?? cur('pana_mode');
    const fan = values.pana_fan ?? cur('pana_fan');
    let temp = values.target_temperature ?? cur('target_temperature');
    temp = Math.min(30, Math.max(16, Math.round(temp)));

    // Turning off: send OFF and stop.
    if ('onoff' in values && values.onoff === false) {
      return this._send({ power: false });
    }
    // Adjusting settings while off: just remember them, don't wake the unit.
    if (!power) return undefined;

    return this._send({
      power: true, mode, temp, fan,
    });
  }

  async _send(state) {
    if (!this.signal) throw new Error('IR blaster signal unavailable');
    const key = cmdKey(state);
    this.log('IR →', key);
    await this.signal.cmd(key);
  }

};
