# Homey App Store listing

Reference for the App Store fields in Homey Developer Tools. The readme below
mirrors the store readme in `/README.txt` (kept short, no URLs, no changelog).

## Tagline / description

Smart climate control over infrared

## Readme

Turn a Panasonic air conditioner into a proper smart-climate device. Set the
temperature, operating mode and fan speed straight from Homey, and use them in
Flows and schedules.

Getting started: add the device (Devices → Add → this app), and place Homey
within line of sight of the indoor unit. Everything is sent through Homey's
built-in infrared, so no extra hardware or cloud account is needed.

The unit has no built-in sensor. To also show room temperature (and humidity)
on the device — as current → target — create a Flow using the action "Set the
measured room temperature" (and "…humidity"), fed from any temperature sensor
you already have in Homey.
