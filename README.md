# SRNE Solar Station Monitor for Linux

An open-source, Linux-native monitoring console, Modbus RTU workbench, and resilient ESP32/ESP8266 wireless telemetry bridge for **SRNE hybrid solar inverters**, **MPPT charge controllers**, and **LiFePO4 battery storage systems**.

Designed as a modern, full-featured replacement for the legacy Windows-only SRNE Solar Station Monitor, with direct browser-to-RS485 communication (Web Serial API), a headless Linux Python/systemd daemon, Home Assistant MQTT integration, and rock-solid wireless logging over Wi-Fi with LittleFS flash buffering.

---

## Supported Hardware

Compatible with SRNE Modbus RTU (9600-8N1) devices and OEM rebrands using the SRNE protocol:

- **Hybrid Inverters**: SRNE HF, HES, ASP, and HESP series (24V / 48V)
- **MPPT Charge Controllers**: SRNE ML, MC, MD, and SR-ML series
- **OEM Rebrands**: SungoldPower, Rich Solar, PowMr, Renogy (Rover/Adventurer), Eco-Worthy, and similar SRNE-manufactured units
- **Batteries**: 16S LiFePO4 (48V), NMC, AGM, GEL, Flooded, and custom user profiles

---

## Features

- **Animated Power Flow Schematic**: Real-time energy routing across Solar PV Array, SRNE Hybrid Inverter, Battery Bank, Utility Grid, and AC Output Loads.
- **Telemetry & 16S LiFePO4 BMS Visualizer**: Individual cell voltage bars, min/max/delta millivolt spread, active balancing indicators, thermal metrics, fan PWM duty cycle, and auxiliary DC load terminal switching.
- **Analytics & CSV Export**: Rolling real-time SVG trend charts for PV generation, AC load, battery SOC, and thermal curves with one-click CSV export.
- **Inverter Parameter Flasher (EEPROM)**: Read/write access to SRNE holding registers (`0xE004`–`0xE013`) via Modbus Function Code `0x06`, including Work Priority Mode (`SOL`, `UTI`, `SBU`, `SUB`), battery chemistry presets, boost/float/cutoff voltages, and charge current limits.
- **Modbus RTU Packet Sniffer & Frame Builder**: Live TX/RX hex frame inspector with CRC-16 (`0xA001`) validation and custom `0x03`/`0x06` command transmission.
- **Diagnostics & Fault Dictionary**: Active alarm monitor with acoustic Web Audio buzzer, fan test control, and searchable SRNE `E01`–`E13` / `W01`–`W03` troubleshooting matrix.
- **ESP32 & ESP8266 Wireless Bridge**:
  - Full-time WebSocket streaming (`/ws`) to the Linux client.
  - 30-second hardware Watchdog Timer (WDT) + `WIFI_NONE_SLEEP` for zero-jitter uptime.
  - **LittleFS Flash Ring Buffer**: Automatically logs 32-byte binary telemetry records to flash whenever Wi-Fi or the client machine disconnects (~45,000 records / ~62 hours at 5s intervals on a 1.5 MB partition).
  - **Automatic Reconnection Sync**: Replays all backlogged offline records in batches upon reconnect and stitches them seamlessly into historical charts.
- **Built-in Physics Simulator**: Standalone workbench with realistic solar irradiance, load spikes, grid outage UPS transfer, and offline sync replay testing — no hardware required to evaluate.

---

## Quick Start (Web Console)

### Prerequisites

- Node.js 20+ (or Bun)
- Chromium / Google Chrome (for direct Web Serial RS485 access on Linux; any modern browser works for ESP32 WebSocket & Simulator modes)

### Install & Run

```bash
git clone https://github.com/<your-username>/srne-solar-station-monitor-linux.git
cd srne-solar-station-monitor-linux
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### Production Build & Type Check

```bash
npm run lint
npm run build
npm run preview
```

---

## Linux USB-to-RS485 Setup

### 1. Grant Serial Port Permissions

Add your Linux user to the `dialout` (Debian/Ubuntu) or `uucp` (Arch) group, then log out and back in:

```bash
sudo usermod -aG dialout $USER
```

Optionally install the included udev rule for a consistent `/dev/srne-inverter` device symlink:

```bash
sudo cp linux/99-srne-rs485.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### 2. Connect Directly in the Browser (Web Serial)

1. Plug your USB-to-RS485 adapter (FTDI FT232RL or CH340) into your Linux machine.
2. Click **Linux Ports** in the top bar and select `/dev/ttyUSB0` at `9600` baud (8N1, Slave ID `1`).
3. Click **Connect USB / RS485 Dongle** and choose your adapter in the browser picker.

### 3. Headless Linux Daemon (Raspberry Pi / Ubuntu Server / Proxmox)

Ready-to-use files are included in `/linux/`:

```bash
sudo mkdir -p /opt/srne
sudo cp linux/srne-daemon.py /opt/srne/
pip3 install -r linux/requirements.txt

sudo cp linux/srne-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now srne-monitor
sudo journalctl -u srne-monitor -f
```

Home Assistant MQTT sensor definitions are provided in [`linux/homeassistant-mqtt.yaml`](linux/homeassistant-mqtt.yaml).

---

## ESP32 / ESP8266 Wireless Bridge Setup

Standalone PlatformIO projects are included in `/firmware/esp32/` and `/firmware/esp8266/`. You can also customize Wi-Fi credentials, baud rate, and logging intervals directly inside the app's **ESP32 WiFi Bridge** tab and download a tailored `.ino` file.

### Hardware Wiring (RS485 to MAX485 / SP3485)

| SRNE RJ45 Port | MAX485 Module | ESP32 GPIO | ESP8266 (D1 Mini / NodeMCU) |
| :--- | :--- | :--- | :--- |
| Pin 1 & 2 (`RS485-A +`) | `A (+)` | — | — |
| Pin 7 & 8 (`RS485-B -`) | `B (-)` | — | — |
| Pin 5 (`Signal GND`) | `GND` | `GND` | `GND` |
| — | `RO` (Receiver Out) | `GPIO 16` (RX2) | `GPIO 13` (D7) |
| — | `DI` (Driver In) | `GPIO 17` (TX2) | `GPIO 15` (D8) |
| — | `DE` & `RE` (tied) | `GPIO 4` | `GPIO 12` (D6) |
| — | `VCC` | `3.3V` / `5V` | `3.3V` |

> **Tip**: Use a 3.3V-compatible RS485 transceiver (such as **SP3485** or **MAX3485**) or a logic-level shifter on `RO` if powering a 5V MAX485 board. For cable runs longer than 10 meters, place a 120 Ω termination resistor across `A` and `B`.

### Flashing with PlatformIO

1. Edit `WIFI_SSID` and `WIFI_PASS` in `firmware/esp32/src/main.cpp` (or `firmware/esp8266/src/main.cpp`).
2. Build and flash:

```bash
cd firmware/esp32
pio run --target upload
pio device monitor
```

3. Open the **ESP32 WiFi Bridge** tab in the web console, enter the ESP's IP address (or `srne-bridge.local`), and click **Connect Bridge**.

---

## Repository Structure

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/          # Bug & hardware support issue templates
│   └── workflows/ci.yml         # GitHub Actions CI (typecheck + Vite build)
├── firmware/
│   ├── esp32/                   # PlatformIO project for ESP32 wireless bridge + LittleFS logger
│   └── esp8266/                 # PlatformIO project for ESP8266 wireless bridge + LittleFS logger
├── linux/
│   ├── 99-srne-rs485.rules      # udev permissions & persistent symlink rules
│   ├── homeassistant-mqtt.yaml  # Home Assistant MQTT sensor configuration
│   ├── requirements.txt         # Python dependencies (minimalmodbus, pyserial)
│   ├── srne-daemon.py           # Headless Linux Modbus polling daemon
│   └── srne-monitor.service     # systemd unit file
├── src/
│   ├── components/              # UI views (PowerFlow, Telemetry, Analytics, Config, Modbus, Diagnostics, ESP Bridge)
│   ├── context/                 # Central SolarContext state & history store
│   ├── types/                   # TypeScript interfaces for telemetry, registers & bridge status
│   └── utils/                   # Modbus CRC-16, register maps, hardware engine & firmware generator
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## Key SRNE Modbus Holding Registers

| Address | Parameter | Scale | Mode |
| :--- | :--- | :--- | :--- |
| `0x0100` | PV Array Voltage | `0.1 V` | R |
| `0x0101` | PV Array Current | `0.1 A` | R |
| `0x0102` | PV Array Power | `1 W` | R |
| `0x0103` | Battery Voltage | `0.1 V` | R |
| `0x0104` | Battery Net Current (Signed) | `0.1 A` | R |
| `0x0105` | Battery State of Charge (SOC) | `1 %` | R |
| `0x0107` | Inverter Heatsink Temperature | `1 °C` | R |
| `0x010D` | AC Active Load Power | `1 W` | R |
| `0x0116` | Active Fault Code | Bitmask | R |
| `0xE004` | Work Priority Mode (`0:SOL, 1:UTI, 2:SBU, 3:SUB`) | Enum | R/W |
| `0xE008` | Boost Charging Voltage | `0.1 V` | R/W |
| `0xE009` | Float Charging Voltage | `0.1 V` | R/W |
| `0xE00A` | Low DC Cut-off Voltage | `0.1 V` | R/W |
| `0xE00E` | Max Total Charging Current | `1 A` | R/W |

---

## Safety Disclaimer

Modifying inverter EEPROM parameters (charging voltages, cut-off thresholds, and output voltage/frequency) directly affects live high-voltage AC and high-current DC battery systems. Always verify values against your inverter and battery manufacturer datasheets before writing registers.

---

## Contributing

Contributions, register map additions for new SRNE models, and hardware test reports are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Licensed under the [Apache License 2.0](LICENSE).
