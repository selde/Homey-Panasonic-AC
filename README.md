# Panasonic AC (IR) — Homey app

Control a Panasonic air conditioner / heat pump from [Homey](https://homey.app)
over infrared, using Homey's **built-in IR blaster**. The unit shows up as a
normal climate device with on/off, target temperature, operating mode and fan
speed — so you get the thermostat tile, Flows and schedules, without pasting raw
IR codes.

## Supported models

| Model                | IR protocol | Status                        |
| -------------------- | ----------- | ----------------------------- |
| Panasonic CS-E12DKEW | DKE         | ✅ Verified on real hardware  |

Other Panasonic units using the **DKE** IR protocol are likely compatible but
untested. Contributions adding and confirming further models are welcome.

## How it works

Panasonic air conditioners don't have a discrete "power on" code — every button
press transmits the **entire state** (power + mode + temperature + fan) as one
frame with a checksum. This app therefore computes the correct full-state frame
for whatever combination you set and sends the matching Pronto HEX command.

The IR encoder in [`lib/panasonic-dke.js`](lib/panasonic-dke.js) is a faithful
port of the Panasonic **DKE** protocol from
[IRremoteESP8266](https://github.com/crankyoldgit/IRremoteESP8266)
(`ir_Panasonic.cpp`). The generated `HEAT / 22°C / auto` frame is byte-for-byte
identical to a code verified working on a real CS-E12DKEW.

All command variants are pre-generated into the IR signal manifest:

```bash
npm run generate   # writes .homeycompose/signals/ir/panasonic_dke.json
```

## Capabilities

| Capability            | Values                                   |
| --------------------- | ---------------------------------------- |
| `onoff`               | on / off                                 |
| `target_temperature`  | 16–30 °C (1° steps)                      |
| `pana_mode`           | auto / heat / cool / dry / fan-only      |
| `pana_fan`            | auto / low / medium / high               |
| `measure_temperature` | room temperature, fed from a Flow        |
| `measure_humidity`    | room humidity, fed from a Flow (optional)|

## Room temperature & humidity

The unit has no sensor of its own. To show room temperature/humidity next to the
setpoint (current → target), use the Flow actions **“Set the measured room
temperature”** / **“…humidity”** — e.g. *when a sensor's temperature changes →
set the measured room temperature*. The humidity capability is added the first
time you set it.

## Install (developer mode)

Requires [Node.js](https://nodejs.org), the
[Homey CLI](https://apps.developer.homey.app/the-basics/getting-started) and a
free Homey developer account. Homey and your computer must be on the same network.

```bash
npm install -g homey
homey login
homey app run        # run live for testing
# or
homey app install    # install onto your Homey
```

Then in the Homey app: **Devices → + → this app → Panasonic CS-E12DKEW**.
Place Homey with line of sight to the indoor unit.

## Limitations

- **One-way.** Homey sends but cannot read the unit's actual state (no IR
  receiver). If someone uses the physical remote, Homey's shown state can drift
  until the next command is sent.
- Vertical swing is left at the unit's default; fan speeds are auto/low/med/high.

## Development

```bash
npm install
npm run generate   # regenerate the IR command map from lib/panasonic-dke.js
npm run images     # regenerate the app/driver artwork
npm run lint       # eslint (eslint-config-athom)
npm test           # unit + round-trip tests (node:test)
npm run validate   # homey app validate --level publish
```

The test suite decodes **all 245** generated Pronto HEX commands back into
state frames and asserts the checksum and every field (power, mode, temperature,
fan) match the command's label — so a bug in the encoder or generator fails CI
rather than reaching hardware. It also pins the encoder against the exact
byte sequence verified on a real CS-E12DKEW.

## Credits & licensing

The Panasonic **DKE** protocol implementation in
[`lib/panasonic-dke.js`](lib/panasonic-dke.js) is derived from
[IRremoteESP8266](https://github.com/crankyoldgit/IRremoteESP8266) by David
Conran and contributors (**LGPL-2.1**); that file is therefore licensed under
**LGPL-2.1** (see [`LICENSE.LGPL-2.1`](LICENSE.LGPL-2.1) and [`NOTICE`](NOTICE)).
All other original code is under the **MIT** license (see [`LICENSE`](LICENSE)).
