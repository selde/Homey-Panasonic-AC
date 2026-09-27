'use strict';

const Homey = require('homey');
const Broadlink = require('kiwicam-broadlinkjs-rm');
const { identifyRm4 } = require('../../lib/broadlink-identify');
const { buildBroadlinkPacket, MODE, FAN } = require('../../lib/panasonic-jke');

const DEFAULTS = {
  onoff: false,
  target_temperature: 22,
  pana_mode: 'heat',
  pana_fan: 'auto',
};

// Capability string values -> JKE protocol constants.
const MODE_MAP = {
  auto: MODE.AUTO, heat: MODE.HEAT, cool: MODE.COOL, dry: MODE.DRY, fan: MODE.FAN,
};
const FAN_MAP = {
  auto: FAN.AUTO, low: FAN.LOW, med: FAN.MED, high: FAN.HIGH,
};

module.exports = class PanasonicDkeDevice extends Homey.Device {

  async onInit() {
    // Migrate devices added before measure_temperature existed.
    if (!this.hasCapability('measure_temperature')) {
      await this.addCapability('measure_temperature').catch(this.error);
    }

    await this._ensureDefaults();

    // --- Broadlink RM4 connection (JKE units are sent over the network
    // to the RM4, instead of through Homey's built-in IR blaster) ---
    const rm4Ip = this.getSetting('rm4_ip');
    if (rm4Ip) {
      this.rm4Device = null;
      this.broadlink = new Broadlink();
      this.broadlink.on('deviceReady', (device) => {
        if (device.host.address === rm4Ip) {
          this.rm4Device = device;
        }
      });
      identifyRm4(rm4Ip)
        .then(({ mac, deviceType }) => {
          this.broadlink.addDevice({ address: rm4Ip, port: 80 }, mac, deviceType);
        })
        .catch((err) => this.error('Could not identify RM4:', err.message));
    }

    // Panasonic sends the whole state in one frame, so batch simultaneous
    // capability changes and emit a single IR command.
    this.registerMultipleCapabilityListener(
      ['onoff', 'target_temperature', 'pana_mode', 'pana_fan'],
      (values) => this._onCapabilities(values),
      500,
    );
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

    if ('onoff' in values && values.onoff === false) {
      const sent = await this._send({
        power: false, mode, temp, fan,
      });

      if (!sent) return undefined;

      await this.setCapabilityValue('onoff', false).catch(this.error);
      return undefined;
    }

    if (!power) {
      // Off: remember the requested settings without sending IR or waking the unit.
      if ('pana_mode' in values) await this.setCapabilityValue('pana_mode', mode).catch(this.error);
      if ('pana_fan' in values) await this.setCapabilityValue('pana_fan', fan).catch(this.error);
      if ('target_temperature' in values) await this.setCapabilityValue('target_temperature', temp).catch(this.error);
      return undefined;
    }

    const sent = await this._send({
      power: true, mode, temp, fan,
    });

    if (!sent) return undefined;

    // Persist all four so Homey's stored state always matches what we
    // actually sent — without this, values silently revert to stale
    // defaults the next time the device page is (re)opened.
    await this.setCapabilityValue('onoff', true).catch(this.error);
    await this.setCapabilityValue('pana_mode', mode).catch(this.error);
    await this.setCapabilityValue('pana_fan', fan).catch(this.error);
    await this.setCapabilityValue('target_temperature', temp).catch(this.error);
    return undefined;
  }

  async _send(state) {
    if (!this.rm4Device) {
      this.error('Cannot send: RM4 not connected yet');
      return false;
    }

    const packet = buildBroadlinkPacket({
      power: state.power,
      mode: MODE_MAP[state.mode],
      temp: state.temp,
      fan: FAN_MAP[state.fan],
    });

    await this.rm4Device.sendData(packet);
    return true;
  }

};
