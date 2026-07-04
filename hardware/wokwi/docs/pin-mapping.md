# ESP32 Pin Mapping — Work Room 1

The firmware in `firmware/esp32-office-room.ino` matches the following pin
assignments. These are ESP32 GPIOs chosen because they are safe for general
digital I/O (no boot-strapping interference) and are easy to wire in the
Wokwi editor.

## Switches (inputs, `INPUT_PULLUP`, pressed = LOW = ON)

| Device        | GPIO | Notes                               |
|---------------|------|-------------------------------------|
| Fan 1 switch  | 32   | input-only, internal pull-up enabled |
| Fan 2 switch  | 33   | input-only                          |
| Light 1 switch| 13   |                                     |
| Light 2 switch| 12   | boot-strapping pin — avoid low at boot |
| Light 3 switch| 14   |                                     |

> Switches are wired between the GPIO and GND. The internal pull-up keeps
> the line HIGH (OFF) when released; pressing the switch shorts it to GND
> which the firmware interprets as **ON**.

## LEDs (outputs, HIGH = lit)

| Device    | GPIO |
|-----------|------|
| Fan 1 LED | 18   |
| Fan 2 LED | 19   |
| Light 1 LED | 25 |
| Light 2 LED | 26 |
| Light 3 LED | 27 |

LEDs are wired with their anode to the GPIO and cathode to GND through an
appropriate current-limiting resistor (≈220 Ω on a 3.3 V ESP32 pin).
In Wokwi, attach the LED directly to the GPIO and GND — the simulator
handles current limiting internally.

## Wokwi diagram snippet

```jsonc
{
  "version": 1,
  "author": "OfficePulse",
  "editor": "wokwi",
  "parts": [
    { "type": "board-esp32-devkit-c-v4", "id": "esp", "top": 0, "left": 0 },
    { "type": "wokwi-pushbutton", "id": "btn-fan1",   "top": -120, "left":  20, "attrs": { "color": "blue"   } },
    { "type": "wokwi-pushbutton", "id": "btn-fan2",   "top": -120, "left":  80, "attrs": { "color": "blue"   } },
    { "type": "wokwi-pushbutton", "id": "btn-light1", "top": -120, "left": 140, "attrs": { "color": "yellow" } },
    { "type": "wokwi-pushbutton", "id": "btn-light2", "top": -120, "left": 200, "attrs": { "color": "yellow" } },
    { "type": "wokwi-pushbutton", "id": "btn-light3", "top": -120, "left": 260, "attrs": { "color": "yellow" } },

    { "type": "wokwi-led",        "id": "led-fan1",   "top":  100, "left":  20, "attrs": { "color": "blue"   } },
    { "type": "wokwi-led",        "id": "led-fan2",   "top":  100, "left":  80, "attrs": { "color": "blue"   } },
    { "type": "wokwi-led",        "id": "led-light1", "top":  100, "left": 140, "attrs": { "color": "yellow" } },
    { "type": "wokwi-led",        "id": "led-light2", "top":  100, "left": 200, "attrs": { "color": "yellow" } },
    { "type": "wokwi-led",        "id": "led-light3", "top":  100, "left": 260, "attrs": { "color": "yellow" } }
  ],
  "connections": [
    [ "esp:TX0",  "$serialMonitor:RX", "" ],
    [ "esp:RX0",  "$serialMonitor:TX", "" ],

    [ "btn-fan1:1.l",   "esp:32",  [ "v:0" ] ], [ "btn-fan1:2.l",   "esp:GND.1", [ "v:0" ] ],
    [ "btn-fan2:1.l",   "esp:33",  [ "v:0" ] ], [ "btn-fan2:2.l",   "esp:GND.1", [ "v:0" ] ],
    [ "btn-light1:1.l", "esp:13",  [ "v:0" ] ], [ "btn-light1:2.l", "esp:GND.1", [ "v:0" ] ],
    [ "btn-light2:1.l", "esp:12",  [ "v:0" ] ], [ "btn-light2:2.l", "esp:GND.1", [ "v:0" ] ],
    [ "btn-light3:1.l", "esp:14",  [ "v:0" ] ], [ "btn-light3:2.l", "esp:GND.1", [ "v:0" ] ],

    [ "esp:18", "led-fan1:A",   "" ], [ "led-fan1:C",   "esp:GND.1", "" ],
    [ "esp:19", "led-fan2:A",   "" ], [ "led-fan2:C",   "esp:GND.1", "" ],
    [ "esp:25", "led-light1:A", "" ], [ "led-light1:C", "esp:GND.1", "" ],
    [ "esp:26", "led-light2:A", "" ], [ "led-light2:C", "esp:GND.1", "" ],
    [ "esp:27", "led-light3:A", "" ], [ "led-light3:C", "esp:GND.1", "" ]
  ]
}
```

A complete `diagram.json` lives at `hardware/wokwi/diagram.json`. Paste the
whole file at <https://wokwi.com/projects/new> → click the "…" menu on the
diagram editor → **Import Diagram** to load it.