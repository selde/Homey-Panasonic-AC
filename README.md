# Panasonic JKE (BroadLink RM4) — Homey app

Control a Panasonic JKE air conditioner / heat pump from [Homey](https://homey.app) using a **BroadLink RM4 Mini** as the IR transmitter.

The app presents the heat pump as a normal Homey climate device with on/off, target temperature, operating mode and fan speed. It can therefore be used with Homey Flows, schedules and the normal climate interface.

## Supported models

| Model                | Protocol      | Status                    |
| -------------------- | ------------- | ------------------------- |
| Panasonic CS-NE12JKE | Panasonic JKE | Verified on real hardware |

The JKE implementation is intended for Panasonic units using the same JKE IR protocol. Other models have not been verified and may use different protocol variants.

## How it works

Panasonic air conditioners transmit the **complete unit state** in each IR command rather than using independent commands for individual settings.

The app therefore builds a complete JKE protocol frame containing:

* Power state
* Operating mode
* Target temperature
* Fan speed
* Protocol checksum

The resulting IR command is sent over the local network to the configured BroadLink RM4.

The Homey app does not use Homey's built-in IR transmitter for JKE commands.

## BroadLink RM4

A BroadLink RM4 Mini must be available on the same local network as the Homey.

During device setup, configure the local IP address of the RM4 that controls the heat pump.

The device setting is:

**BroadLink RM4 → RM4 IP address**

Example:

```text
10.47.102.129
```

A fixed or reserved IP address for the RM4 is recommended so that the Homey device does not lose contact with it after a DHCP lease changes.

## Capabilities

| Capability            | Values                                           |
| --------------------- | ------------------------------------------------ |
| `onoff`               | On / Off                                         |
| `target_temperature`  | 16–30 °C, 1 °C steps                             |
| `pana_mode`           | Auto / Heat / Cool / Dry / Fan only              |
| `pana_fan`            | Auto / Low / Medium / High                       |
| `measure_temperature` | Room temperature supplied by a Homey Flow        |
| `measure_humidity`    | Optional humidity value supplied by a Homey Flow |

## Room temperature and humidity

The Panasonic unit does not provide its actual room temperature or humidity to Homey through this integration.

The `measure_temperature` capability can instead be updated from another Homey device using the Flow action:

**Set the measured room temperature**

Similarly, humidity can be supplied using:

**Set the measured room humidity**

The humidity capability is added to the device when it is first used.

## Limitations

### One-way communication

The integration is **one-way**.

Homey can send commands to the heat pump through the BroadLink RM4, but it cannot read the current state of the physical unit or remote control.

If the heat pump is operated using its original remote control, the state displayed by Homey can therefore become out of sync until another command is sent through Homey.

### BroadLink dependency

The heat pump requires a functioning BroadLink RM4 connection.

If the RM4 is unavailable when a command is issued, the command cannot be transmitted.

### Swing

Vertical swing control is not currently implemented.

## Installation

This is a Homey SDK 3 application intended for local development and testing.

Requirements:

* Node.js
* Homey CLI
* A Homey developer account
* A BroadLink RM4 Mini on the same local network as Homey

Install the Homey CLI:

```bash
npm install -g homey
```

Log in:

```bash
homey login
```

Install the project dependencies:

```bash
npm install
```

Run the app for development:

```bash
homey app run
```

Or install it directly on the Homey:

```bash
homey app install
```

After installing the app, add a **Panasonic JKE** device in Homey and enter the local IP address of the BroadLink RM4 that controls the heat pump.

## Development

Install dependencies:

```bash
npm install
```

Run the linter:

```bash
npm run lint
```

Run the test suite:

```bash
npm test
```

Validate the Homey app:

```bash
npm run validate
```

## Project structure

The Panasonic JKE protocol implementation is located in:

```text
lib/panasonic-jke.js
```

BroadLink RM4 identification is handled by:

```text
lib/broadlink-identify.js
```

The Homey device driver is located in:

```text
drivers/heatpump/
```

## Credits and licensing

This project is based on the original **Homey Panasonic AC** project by **Joran Haugli** (`haugli92`), with further development for Panasonic JKE units and BroadLink RM4 control.

Original project:

https://github.com/haugli92/Homey-Panasonic-AC

This fork:

https://github.com/selde/Homey-Panasonic-AC

Please see the repository license and attribution files for licensing information.
