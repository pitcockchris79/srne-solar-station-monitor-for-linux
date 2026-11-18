/**
 * SRNE Solar Station Monitor Data Types
 * Supports SRNE Hybrid Inverters (HF, HES, ASP series) and MPPT Charge Controllers (ML, MC, MD series)
 */

export type ConnectionMode = 'simulator' | 'webserial' | 'esp32' | 'modbustcp';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface EspBridgeStatus {
  connected: boolean;
  ip: string;
  port: number;
  chipType: 'ESP32' | 'ESP8266';
  rssi: number;
  freeHeap: number;
  uptimeSeconds: number;
  bufferedRecordsCount: number;
  totalFlashBytes: number;
  usedFlashBytes: number;
  isSyncing: boolean;
  syncProgressPct: number;
  syncedRecordsTotal: number;
  firmwareVersion: string;
  wdtActive: boolean;
  lastSyncTimestamp: number | null;
}

export interface OfflineSyncRecord {
  timestamp: number;
  pvPower: number;
  pvVoltage: number;
  batterySoc: number;
  batteryVoltage: number;
  batteryPower: number;
  loadPower: number;
  gridPower: number;
  heatsinkTemp: number;
}

export type WorkMode = 'SOL' | 'UTI' | 'SBU' | 'SUB';

export type BatteryChemistry = 'LiFePO4' | 'TernaryLithium' | 'AGM' | 'GEL' | 'Flooded' | 'User';

export type ChargeStage = 'Bulk' | 'Boost' | 'Float' | 'Equalize' | 'Discharging' | 'Standby';

export type InverterStatus = 'Inverting' | 'Bypass' | 'Soft Start' | 'Charging' | 'Standby' | 'Fault';

export interface SerialConfig {
  port: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'even' | 'odd';
  slaveId: number;
}

export interface TcpConfig {
  host: string;
  port: number;
  slaveId: number;
}

export interface BmsCell {
  id: number;
  voltage: number; // in Volts, e.g. 3.335
  balancing: boolean;
}

export interface FaultItem {
  id: string;
  code: string;
  title: string;
  level: 'fault' | 'warning' | 'info';
  timestamp: string;
  description: string;
  solution: string;
}

export interface SolarTelemetry {
  // Solar PV Array
  pvVoltage: number; // Volts
  pvCurrent: number; // Amperes
  pvPower: number; // Watts
  pvTodayYieldKwh: number; // kWh
  pvTotalYieldKwh: number; // kWh
  pvPeakPowerToday: number; // Watts
  pvStatus: 'Charging' | 'Idle' | 'No Light' | 'Fault';

  // Battery System
  batteryVoltage: number; // Volts
  batteryCurrent: number; // Amperes (positive = into battery / charging, negative = out / discharging)
  batteryPower: number; // Watts
  soc: number; // State of Charge %
  soh: number; // State of Health %
  batteryTemp: number; // °C
  chargeStage: ChargeStage;
  chemistry: BatteryChemistry;
  cells: BmsCell[];
  cycles: number;
  capacityAh: number;
  remainingRunHours: number;

  // Inverter & AC Output
  workMode: WorkMode;
  inverterStatus: InverterStatus;
  acOutputVoltage: number; // Volts
  acOutputCurrent: number; // Amperes
  acOutputFrequency: number; // Hz
  acOutputActivePower: number; // Watts
  acOutputApparentPower: number; // VA
  loadPercentage: number; // %
  heatsinkTemp: number; // °C
  transformerTemp: number; // °C
  fanSpeed: number; // %
  efficiency: number; // %
  acTodayConsumptionKwh: number; // kWh
  acTotalConsumptionKwh: number; // kWh

  // Grid / Utility Input
  gridConnected: boolean;
  gridVoltage: number; // Volts
  gridFrequency: number; // Hz
  gridPower: number; // Watts
  gridChargeCurrent: number; // Amperes

  // DC Load Output (for MPPT units)
  dcLoadOn: boolean;
  dcLoadVoltage: number; // Volts
  dcLoadCurrent: number; // Amperes
  dcLoadPower: number; // Watts
  dcLoadMode: 'Manual' | 'Light Control' | 'Light + Timer' | 'Reverse Logic';

  // System Flags
  buzzerEnabled: boolean;
  ecoModeEnabled: boolean;
  activeFaults: FaultItem[];
  timestamp: number;
}

export interface InverterSettings {
  workMode: WorkMode;
  chemistry: BatteryChemistry;
  nominalSystemVoltage: 12 | 24 | 48;
  boostVoltage: number; // e.g. 56.8V
  floatVoltage: number; // e.g. 54.0V
  lowDcCutoffVoltage: number; // e.g. 44.0V
  lowDcRecoveryVoltage: number; // e.g. 50.0V
  maxTotalChargeCurrent: number; // e.g. 80A
  maxUtilityChargeCurrent: number; // e.g. 30A
  maxSolarChargeCurrent: number; // e.g. 80A
  acOutputVoltage: 120 | 208 | 230 | 240;
  acOutputFrequency: 50 | 60;
  buzzerAlarm: boolean;
  autoRestartOverload: boolean;
  autoRestartOvertemp: boolean;
  backlightTimeoutSeconds: number;
  ecoMode: boolean;
}

export interface ModbusPacket {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX';
  rawBytes: string; // Space separated hex, e.g. "01 03 01 00 00 20 45 F2"
  slaveId: number;
  functionCode: number;
  address?: number;
  byteCount?: number;
  crcValid: boolean;
  summary: string;
}

export interface HistoryPoint {
  time: string;
  timestamp: number;
  pvPower: number;
  loadPower: number;
  batteryPower: number;
  batterySoc: number;
  gridPower: number;
  heatsinkTemp: number;
}
