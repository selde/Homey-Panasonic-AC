'use strict';

const dgram = require('dgram');

/**
 * Identify a Broadlink device at a known IP by sending the standard
 * discovery "hello" packet directly (unicast) instead of broadcasting it —
 * broadcast discovery doesn't reach devices from within Homey's app sandbox,
 * but a direct request to a known address does.
 * @param {string} ip
 * @param {number} [timeoutMs]
 * @returns {Promise<{mac: Buffer, deviceType: number}>}
 */
function identifyRm4(ip, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`No response from ${ip} within ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on('message', (message) => {
      clearTimeout(timer);
      const mac = Buffer.alloc(6, 0);
      message.copy(mac, 0x00, 0x3F, 0x40);
      message.copy(mac, 0x01, 0x3E, 0x3F);
      message.copy(mac, 0x02, 0x3D, 0x3E);
      message.copy(mac, 0x03, 0x3C, 0x3D);
      message.copy(mac, 0x04, 0x3B, 0x3C);
      message.copy(mac, 0x05, 0x3A, 0x3B);
      const deviceType = message[0x34] | (message[0x35] << 8);
      socket.close();
      resolve({ mac, deviceType });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });

    socket.bind(0, () => {
      const now = new Date();
      const packet = Buffer.alloc(0x30, 0);
      const timezone = now.getTimezoneOffset() / -3600;

      if (timezone < 0) {
        packet[0x08] = 0xff + timezone - 1;
        packet[0x09] = 0xff;
        packet[0x0a] = 0xff;
        packet[0x0b] = 0xff;
      } else {
        packet[0x08] = timezone;
      }

      const year = now.getYear();
      packet[0x0c] = year & 0xff;
      packet[0x0d] = year >> 8;
      packet[0x0e] = now.getMinutes();
      packet[0x0f] = now.getHours();
      packet[0x10] = year % 100;
      packet[0x11] = now.getDay();
      packet[0x12] = now.getDate();
      packet[0x13] = now.getMonth();
      packet[0x26] = 6;

      let checksum = 0xbeaf;
      for (let i = 0; i < packet.length; i++) checksum += packet[i];
      checksum &= 0xffff;
      packet[0x20] = checksum & 0xff;
      packet[0x21] = checksum >> 8;

      socket.send(packet, 0, packet.length, 80, ip);
    });
  });
}

module.exports = { identifyRm4 };