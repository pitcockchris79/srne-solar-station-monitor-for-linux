/**
 * SRNE Modbus RTU Protocol Utilities
 * Implements standard Modbus CRC-16 (polynomial 0xA001) and SRNE Holding Register mappings.
 */

import { FaultItem, InverterSettings, SolarTelemetry } from '../types/srne';

// Standard Modbus RTU CRC16 table / generator
export function calculateModbusCrc16(buffer: Uint8Array): number {
  let crc = 0xffff;
  for (let pos = 0; pos < buffer.length; pos++) {
    crc ^= buffer[pos];
    for (let i = 8; i !== 0; i--) {
      if ((crc & 0x0001) !== 0) {
        crc >>= 1;
        crc ^= 0xa001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

export function appendCrc16(data: Uint8Array): Uint8Array {
  const crc = calculateModbusCrc16(data);
  const result = new Uint8Array(data.length + 2);
  result.set(data);
  // Modbus CRC is little-endian: low byte first, high byte second
  result[data.length] = crc & 0xff;
  result[data.length + 1] = (crc >> 8) & 0xff;
  return result;
}

export function verifyCrc16(frame: Uint8Array): boolean {
  if (frame.length < 4) return false;
  const payload = frame.subarray(0, frame.length - 2);
  const expectedCrc = calculateModbusCrc16(payload);
  const actualCrc = frame[frame.length - 2] | (frame[frame.length - 1] << 8);
  return expectedCrc === actualCrc;
}

export function formatHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

export function parseHex(hexStr: string): Uint8Array {
  const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Build standard Function 0x03 Read Holding Registers frame
 */
export function buildReadHoldingRegisters(
  slaveId: number,
  startAddress: number,
  quantity: number
): Uint8Array {
  const payload = new Uint8Array([
    slaveId & 0xff,
    0x03,
    (startAddress >> 8) & 0xff,
    startAddress & 0xff,
    (quantity >> 8) & 0xff,
    quantity & 0xff,
  ]);
  return appendCrc16(payload);
}

/**
 * Build standard Function 0x06 Write Single Register frame
 */
export function buildWriteSingleRegister(
  slaveId: number,
  address: number,
  value: number
): Uint8Array {
  const payload = new Uint8Array([
    slaveId & 0xff,
    0x06,
    (address >> 8) & 0xff,
    address & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ]);
  return appendCrc16(payload);
}

/**
 * SRNE Register Map Definitions
 * Standard SRNE HF / ML / MC / HES hybrid inverters and MPPT units
 */
export const SRNE_REGISTERS = {
  // Telemetry (Read Only, Function 0x03 or 0x04)
  PV_VOLTAGE: { addr: 0x0100, scale: 0.1, unit: 'V', name: 'PV Array Voltage' },
  PV_CURRENT: { addr: 0x0101, scale: 0.1, unit: 'A', name: 'PV Array Current' },
  PV_POWER: { addr: 0x0102, scale: 1.0, unit: 'W', name: 'PV Array Power' },
  BAT_VOLTAGE: { addr: 0x0103, scale: 0.1, unit: 'V', name: 'Battery Voltage' },
  BAT_CURRENT: { addr: 0x0104, scale: 0.1, unit: 'A', name: 'Battery Net Current (Signed)' },
  BAT_SOC: { addr: 0x0105, scale: 1.0, unit: '%', name: 'Battery State of Charge' },
  BAT_TEMP: { addr: 0x0106, scale: 1.0, unit: '°C', name: 'Battery Temperature' },
  HEATSINK_TEMP: { addr: 0x0107, scale: 1.0, unit: '°C', name: 'Inverter Heatsink Temp' },
  TRANSFORMER_TEMP: { addr: 0x0108, scale: 1.0, unit: '°C', name: 'Transformer/Ambient Temp' },
  GRID_VOLTAGE: { addr: 0x0109, scale: 0.1, unit: 'V', name: 'Grid / AC Input Voltage' },
  GRID_FREQ: { addr: 0x010A, scale: 0.01, unit: 'Hz', name: 'Grid Frequency' },
  AC_OUT_VOLTAGE: { addr: 0x010B, scale: 0.1, unit: 'V', name: 'AC Output Voltage' },
  AC_OUT_FREQ: { addr: 0x010C, scale: 0.01, unit: 'Hz', name: 'AC Output Frequency' },
  AC_OUT_POWER: { addr: 0x010D, scale: 1.0, unit: 'W', name: 'AC Active Load Power' },
  AC_OUT_VA: { addr: 0x010E, scale: 1.0, unit: 'VA', name: 'AC Apparent Load Power' },
  LOAD_PERCENT: { addr: 0x010F, scale: 0.1, unit: '%', name: 'Inverter Load Percentage' },
  TODAY_PV_KWH: { addr: 0x0110, scale: 0.01, unit: 'kWh', name: 'Daily Solar Yield' },
  TOTAL_PV_KWH: { addr: 0x0112, scale: 1.0, unit: 'kWh', name: 'Total Solar Yield' },
  TODAY_LOAD_KWH: { addr: 0x0113, scale: 0.01, unit: 'kWh', name: 'Daily Load Consumption' },
  TOTAL_LOAD_KWH: { addr: 0x0114, scale: 1.0, unit: 'kWh', name: 'Total Load Consumption' },
  INVERTER_STATUS_WORD: { addr: 0x0115, scale: 1.0, unit: '', name: 'Inverter Status Bitmask' },
  FAULT_CODE: { addr: 0x0116, scale: 1.0, unit: '', name: 'Fault Code' },
  WARNING_CODE: { addr: 0x0117, scale: 1.0, unit: '', name: 'Warning Code' },

  // Parameters (Read/Write, Function 0x03 / 0x06)
  SET_WORK_MODE: { addr: 0xE004, name: 'Work Priority Mode (0:SOL, 1:UTI, 2:SBU, 3:SUB)' },
  SET_BATTERY_TYPE: { addr: 0xE005, name: 'Battery Chemistry (0:User, 1:Flooded, 2:GEL, 3:AGM, 4:LiFePO4)' },
  SET_BOOST_VOLT: { addr: 0xE008, scale: 0.1, unit: 'V', name: 'Boost Charging Voltage' },
  SET_FLOAT_VOLT: { addr: 0xE009, scale: 0.1, unit: 'V', name: 'Float Charging Voltage' },
  SET_LOW_DC_CUTOFF: { addr: 0xE00A, scale: 0.1, unit: 'V', name: 'Low DC Cut-off Voltage' },
  SET_LOW_DC_RECOVERY: { addr: 0xE00B, scale: 0.1, unit: 'V', name: 'Low DC Cut-off Recovery' },
  SET_MAX_CHARGE_CURR: { addr: 0xE00E, scale: 1.0, unit: 'A', name: 'Max Total Charging Current' },
  SET_MAX_UTILITY_CURR: { addr: 0xE00F, scale: 1.0, unit: 'A', name: 'Max Utility Charging Current' },
  SET_AC_OUT_VOLT: { addr: 0xE010, scale: 1.0, unit: 'V', name: 'Nominal AC Output Voltage' },
  SET_AC_OUT_FREQ: { addr: 0xE011, scale: 1.0, unit: 'Hz', name: 'Nominal AC Output Frequency' },
  SET_BUZZER_ENABLE: { addr: 0xE012, name: 'Acoustic Buzzer Enable (0:Off, 1:On)' },
  SET_ECO_MODE: { addr: 0xE013, name: 'Power Saving Eco Mode (0:Off, 1:On)' },
};

/**
 * Complete SRNE Error & Warning Diagnostic Matrix
 */
export const SRNE_FAULT_DICTIONARY: Record<
  string,
  { title: string; description: string; solution: string; level: 'fault' | 'warning' | 'info' }
> = {
  E01: {
    title: 'Battery Reverse Connection',
    description: 'Battery polarities (+) and (-) are reversed at the DC input terminals.',
    solution: 'Immediately disconnect inverter DC breaker, swap cables to correct polarity, and check internal DC fuses.',
    level: 'fault',
  },
  E02: {
    title: 'Battery Over-Voltage',
    description: 'Battery terminal voltage exceeded the hardware maximum over-voltage protection limit.',
    solution: 'Verify solar MPPT charging parameters, check if external chargers or BMS load-dump occurred, and inspect battery voltage.',
    level: 'fault',
  },
  E03: {
    title: 'Battery Under-Voltage / Over-Discharge',
    description: 'Battery voltage dropped below the low DC cut-off threshold.',
    solution: 'Charge battery bank from solar or grid utility. Inverter will auto-recover once recovery voltage is attained.',
    level: 'warning',
  },
  E04: {
    title: 'AC Output Short Circuit',
    description: 'Inverter output detected a short circuit on the AC line/neutral or severe output dead short.',
    solution: 'Disconnect all downstream breaker branch circuits, inspect AC wiring for loose strands or damaged insulation, then reset inverter.',
    level: 'fault',
  },
  E05: {
    title: 'Inverter Heatsink Over-Temperature',
    description: 'Internal IGBT power stage heatsink temperature exceeded 85°C.',
    solution: 'Clean cooling fan intake filters, ensure 20cm clearance around the chassis, and check cooling fan operation.',
    level: 'fault',
  },
  E06: {
    title: 'Inverter AC Overload',
    description: 'Connected AC electrical loads exceeded 110% rating for >5 mins or 150% rating for >10 secs.',
    solution: 'Shed non-essential heavy appliance loads (pumps, HVAC, induction cooktops). Reset load breaker.',
    level: 'fault',
  },
  E07: {
    title: 'Inverter Soft-Start Hardware Abnormal',
    description: 'DC-AC bridge soft-charge voltage did not stabilize within the expected initialization window.',
    solution: 'Perform full power cycle of DC and AC breakers. If issue persists, contact authorized SRNE service center.',
    level: 'fault',
  },
  E08: {
    title: 'PV Array Reverse Polarity',
    description: 'Solar panel array string connected with reversed positive and negative leads.',
    solution: 'Turn off PV isolator switch, measure voltage with multimeter, and swap MC4 connectors to match inverter markings.',
    level: 'fault',
  },
  E09: {
    title: 'PV Array Over-Voltage (VOC Limit Exceeded)',
    description: 'Solar string open-circuit voltage (Voc) exceeded the MPPT hardware ceiling (e.g. 150V or 500V).',
    solution: 'DANGER: Calculate coldest-temperature Voc temperature coefficient. Reconfigure panel strings to reduce series count.',
    level: 'fault',
  },
  E10: {
    title: 'BMS CAN / RS485 Communication Lost',
    description: 'No heartbeat packet received from lithium battery management system for over 60 seconds.',
    solution: 'Verify RJ45 communication pinout (RS485 A/B or CAN H/L), verify battery BMS protocol ID setting (e.g. Pylontech / Pace / SRNE).',
    level: 'warning',
  },
  E11: {
    title: 'Cooling Fan Locked / Stall Error',
    description: 'Fan tachometer pulse feedback is missing or fan current is out of range.',
    solution: 'Check fan blades for insect debris or physical blockage. Replace cooling fan if motor has seized.',
    level: 'warning',
  },
  E12: {
    title: 'BUS High-Voltage Surge Protection',
    description: 'Internal DC bus capacitor bank experienced voltage spike beyond threshold.',
    solution: 'Check for heavy inductive motor kickback or grid surge. Install Type 2 surge protective device (SPD).',
    level: 'fault',
  },
  E13: {
    title: 'Battery Cell Imbalance Alarm',
    description: 'Lithium BMS reported cell delta exceeding 150mV between highest and lowest cell.',
    solution: 'Allow system to maintain Absorption / Boost voltage for several hours to enable active/passive cell balancing resistors.',
    level: 'warning',
  },
  W01: {
    title: 'PV Current Limiting (Over-Power Warning)',
    description: 'Available solar array power exceeds rated MPPT controller rating; unit is clipping peak power.',
    solution: 'Normal MPPT overpaneling behavior. Controller safely throttles input current to protect electronics.',
    level: 'info',
  },
  W02: {
    title: 'Grid Frequency Out of Range',
    description: 'Mains grid or backup generator AC frequency drifted beyond 45Hz-65Hz sync window.',
    solution: 'If running a generator, calibrate generator governor / throttle screw to steady 60.0Hz (or 50.0Hz).',
    level: 'warning',
  },
  W03: {
    title: 'Ambient Temperature High Derating',
    description: 'Inverter operating in high ambient temperature (>45°C); output power derating active.',
    solution: 'Improve equipment room ventilation or install active exhaust ducting.',
    level: 'warning',
  },
};

/**
 * Generate Python Daemon Script for Linux Users (Headless Raspberry Pi / Ubuntu Server)
 */
export function generateLinuxDaemonPython(
  port = '/dev/ttyUSB0',
  baud = 9600,
  slaveId = 1
): string {
  return `#!/usr/bin/env python3
"""
SRNE Solar Station Monitor Daemon for Linux
Compatible with Raspberry Pi, Debian, Ubuntu, Proxmox, and Home Assistant.
Monitors SRNE Hybrid Inverters & MPPT controllers via Modbus RTU (RS485).
"""

import time
import json
import logging
import minimalmodbus
import serial

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

PORT = "${port}"
BAUDRATE = ${baud}
SLAVE_ID = ${slaveId}

def main():
    logging.info(f"Connecting to SRNE Inverter on {PORT} at {BAUDRATE} baud (Slave ID: {SLAVE_ID})...")
    
    try:
        instrument = minimalmodbus.Instrument(PORT, SLAVE_ID)
        instrument.serial.baudrate = BAUDRATE
        instrument.serial.bytesize = 8
        instrument.serial.parity = serial.PARITY_NONE
        instrument.serial.stopbits = 1
        instrument.serial.timeout = 1.0
        instrument.mode = minimalmodbus.MODE_RTU
        instrument.clear_buffers_before_each_transaction = True
        
        logging.info("Connected successfully! Starting telemetry polling loop...")
        
        while True:
            try:
                # Read 24 telemetry registers starting at 0x0100
                registers = instrument.read_registers(0x0100, 24, functioncode=3)
                
                pv_volts = registers[0] * 0.1
                pv_current = registers[1] * 0.1
                pv_power = registers[2]
                bat_volts = registers[3] * 0.1
                bat_current = registers[4] * 0.1  # Signed value
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
                        "today_kwh": round(today_pv_kwh, 2)
                    },
                    "battery": {
                        "voltage_v": round(bat_volts, 1),
                        "current_a": round(bat_current, 1),
                        "soc_pct": bat_soc,
                        "temp_c": bat_temp
                    },
                    "inverter": {
                        "ac_output_v": round(ac_out_volts, 1),
                        "load_power_w": ac_out_power,
                        "load_pct": round(load_pct, 1),
                        "heatsink_temp_c": heatsink_temp,
                        "grid_v": round(grid_volts, 1)
                    }
                }
                
                logging.info(f"PV: {pv_power}W ({pv_volts:.1f}V) | BAT: {bat_soc}% ({bat_volts:.1f}V) | AC LOAD: {ac_out_power}W ({load_pct:.0f}%)")
                
                # Optionally write to local JSON cache or pipe to MQTT
                with open("/run/srne_live.json", "w") as f:
                    json.dump(payload, f)
                    
            except Exception as e:
                logging.warning(f"Modbus read error: {e}")
                
            time.sleep(2.0)
            
    except Exception as e:
        logging.error(f"Failed to initialize serial port {PORT}: {e}")

if __name__ == "__main__":
    main()
`;
}

/**
 * Generate Linux Systemd Service Unit File
 */
export function generateSystemdUnit(): string {
  return `[Unit]
Description=SRNE Solar Station Modbus Monitor Daemon
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/srne/srne-daemon.py
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
`;
}

/**
 * Generate Home Assistant MQTT Sensor Configuration (configuration.yaml)
 */
export function generateHomeAssistantYaml(): string {
  return `mqtt:
  sensor:
    - name: "SRNE Solar PV Power"
      state_topic: "srne/telemetry"
      value_template: "{{ value_json.solar.power_w }}"
      unit_of_measurement: "W"
      device_class: power
      state_class: measurement
      
    - name: "SRNE Battery SOC"
      state_topic: "srne/telemetry"
      value_template: "{{ value_json.battery.soc_pct }}"
      unit_of_measurement: "%"
      device_class: battery
      state_class: measurement

    - name: "SRNE Battery Voltage"
      state_topic: "srne/telemetry"
      value_template: "{{ value_json.battery.voltage_v }}"
      unit_of_measurement: "V"
      device_class: voltage
      state_class: measurement

    - name: "SRNE AC Load Power"
      state_topic: "srne/telemetry"
      value_template: "{{ value_json.inverter.load_power_w }}"
      unit_of_measurement: "W"
      device_class: power
      state_class: measurement
`;
}
