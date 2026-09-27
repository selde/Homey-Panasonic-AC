'use strict';

const Homey = require('homey');
const { randomUUID } = require('crypto');

module.exports = class PanasonicDkeDriver extends Homey.Driver {

  async onInit() {
    // Flow actions let a user feed room temperature/humidity from any sensor
    // (e.g. "when <sensor> changes → set the measured room temperature").
    this.homey.flow.getActionCard('set_room_temperature')
      .registerRunListener(({ device, temperature }) => device.setMeasured('measure_temperature', temperature));
    this.homey.flow.getActionCard('set_room_humidity')
      .registerRunListener(({ device, humidity }) => device.setMeasured('measure_humidity', humidity));

    this.homey.flow.getActionCard('set_fan_speed')
      .registerRunListener(async ({ device, fan_speed: fanSpeed }) => {
        return device.setFanSpeed(fanSpeed);
      });

    this.homey.flow.getActionCard('set_mode')
      .registerRunListener(async ({ device, mode }) => {
        return device.setMode(mode);
      });

    this.log('Panasonic driver initialised');
  }

  // No discovery for an IR device. Offer one unit to add, with a unique id so
  // multiple air conditioners can be added and configured independently.
  async onPairListDevices() {
    return [
      {
        name: 'Panasonic',
        data: { id: randomUUID() },
      },
    ];
  }

};
