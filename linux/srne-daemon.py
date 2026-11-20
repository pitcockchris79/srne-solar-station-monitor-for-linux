#!/usr/bin/env python3
"""
SRNE Solar Station Monitor Daemon for Linux
Compatible with Raspberry Pi, Debian, Ubuntu, Proxmox, and Home Assistant.
Monitors SRNE Hybrid Inverters & MPPT controllers via Modbus RTU (RS485).
"""

import os
import time
import json
import logging
import minimalmodbus
import serial

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

PORT = os.environ.get("SRNE_PORT", "/dev/ttyUSB0")
BAUDRATE = int(os.environ.get("SRNE_BAUD", "9600"))
SLAVE_ID = int(os.environ.get("SRNE_SLAVE_ID", "1"))
POLL_SECONDS = float(os.environ.get("SRNE_POLL_SECONDS", "2.0"))
OUTPUT_JSON = os.environ.get("SRNE_OUTPUT_JSON", "/run/srne_live.json")


def main():
    logging.info(
        "Connecting to SRNE Inverter on %s at %d baud (Slave ID: %d)...",
        PORT,
        BAUDRATE,
        SLAVE_ID,
    )

    try:
        instrument = minimalmodbus.Instrument(PORT, SLAVE_ID)
        instrument.serial.baudrate = BAUDRATE
        instrument.serial.bytesize = 8
        instrument.serial.parity = serial.PARITY_NONE
        instrument.serial.stopbits = 1
        instrument.serial.timeout = 1.0
        instrument.mode = minimalmodbus.MODE_RTU
        instrument.clear_buffers_before_each_transaction = True

        logging.info("Connected successfully. Starting telemetry polling loop...")

        while True:
            try:
                registers = instrument.read_registers(0x0100, 24, functioncode=3)

                pv_volts = registers[0] * 0.1
                pv_current = registers[1] * 0.1
                pv_power = registers[2]
                bat_volts = registers[3] * 0.1
                raw_bat_curr = registers[4]
                if raw_bat_curr >= 0x8000:
                    raw_bat_curr -= 0x10000
                bat_current = raw_bat_curr * 0.1
                bat_soc = registers[5]
                bat_temp = registers[6]
                heatsink_temp = registers[7]
                grid_volts = registers[9] * 0.1
                ac_out_volts = registers[11] * 0.1
                ac_out_power = registers[13]
                load_pct = registers[15] * 0.1
                today_pv_kwh = registers[16] * 0.01

                payload = {
                    "timestamp": time.time(),
                    "solar": {
                        "voltage_v": round(pv_volts, 1),
                        "current_a": round(pv_current, 1),
                        "power_w": pv_power,
                        "today_kwh": round(today_pv_kwh, 2),
                    },
                    "battery": {
                        "voltage_v": round(bat_volts, 1),
                        "current_a": round(bat_current, 1),
                        "soc_pct": bat_soc,
                        "temp_c": bat_temp,
                    },
                    "inverter": {
                        "ac_output_v": round(ac_out_volts, 1),
                        "load_power_w": ac_out_power,
                        "load_pct": round(load_pct, 1),
                        "heatsink_temp_c": heatsink_temp,
                        "grid_v": round(grid_volts, 1),
                    },
                }

                logging.info(
                    "PV: %dW (%.1fV) | BAT: %d%% (%.1fV) | AC LOAD: %dW (%.0f%%)",
                    pv_power,
                    pv_volts,
                    bat_soc,
                    bat_volts,
                    ac_out_power,
                    load_pct,
                )

                tmp_path = f"{OUTPUT_JSON}.tmp"
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(payload, f)
                os.replace(tmp_path, OUTPUT_JSON)

            except Exception as err:
                logging.warning("Modbus read error: %s", err)

            time.sleep(POLL_SECONDS)

    except Exception as err:
        logging.error("Failed to initialize serial port %s: %s", PORT, err)
        raise


if __name__ == "__main__":
    main()
