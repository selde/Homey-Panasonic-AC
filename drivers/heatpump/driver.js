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

    this.log('Panasonic CS-E12DKEW driver initialised');
  }

  // No discovery for an IR device. Offer one unit to add, with a unique id so
  // multiple air conditioners can be added and configured independently.
  async onPairListDevices() {
    return [
      {
        name: 'Panasonic CS-E12DKEW',
        data: { id: randomUUID() },
      },
    ];
  }

};
