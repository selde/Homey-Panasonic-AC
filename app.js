'use strict';

const Homey = require('homey');

class PanasonicDkeApp extends Homey.App {

  async onInit() {
    this.log('Panasonic AC (IR) app initialised');
  }

}

module.exports = PanasonicDkeApp;
