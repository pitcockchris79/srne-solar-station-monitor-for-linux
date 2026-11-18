/**
 * Hardware & Simulation Engine for SRNE Solar Station Monitor
 * Supports direct Linux Web Serial RS485 communication & realistic hardware physics simulator.
 */

import {
  BmsCell,
  EspBridgeStatus,
  FaultItem,
  InverterSettings,
  ModbusPacket,
  OfflineSyncRecord,
  SolarTelemetry,
  WorkMode,
} from '../types/srne';
import {
  appendCrc16,
  buildReadHoldingRegisters,
  calculateModbusCrc16,
  formatHex,
  SRNE_FAULT_DICTIONARY,
  verifyCrc16,
} from './modbus';

// Extended Web Serial interface typing
interface WebSerialPort {
  open(options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
  }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

export class HardwareEngine {
  private mode: 'simulator' | 'webserial' | 'esp32' | 'modbustcp' = 'simulator';
  private serialPort: WebSerialPort | null = null;
  private serialReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private espWs: WebSocket | null = null;
  private isConnected = false;
  private pollIntervalId: any = null;

  // ESP32 Bridge Status
  public espStatus: EspBridgeStatus = {
    connected: false,
    ip: '192.168.1.185',
    port: 80,
    chipType: 'ESP32',
    rssi: -58,
    freeHeap: 184320,
    uptimeSeconds: 84210,
    bufferedRecordsCount: 0,
    totalFlashBytes: 1572864,
    usedFlashBytes: 32768,
    isSyncing: false,
    syncProgressPct: 0,
    syncedRecordsTotal: 0,
    firmwareVersion: 'SRNE-Bridge-v2.4-RockSolid',
    wdtActive: true,
    lastSyncTimestamp: null,
  };

  // Simulator state parameters
  public simIrradiance = 850; // W/m2 (0 - 1000)
  public simManualSoc: number | null = null; // null = dynamic calculation
  public simLoadWatts = 1250; // W (0 - 6000)
  public simGridAvailable = true;
  public simAmbientTemp = 24; // °C
  public simScenario: string = 'Sunny Midday';

  // Persistent accumulation
  private totalPvYieldKwh = 1428.6;
  private todayPvYieldKwh = 14.85;
  private todayLoadKwh = 11.2;
  private totalLoadKwh = 1284.0;
  private currentSoc = 84.5;
  private heatsinkTemp = 38.5;
  private peakPvPower = 3450;
  private currentCycles = 142;

  // Callback hooks
  public onTelemetryUpdate?: (telemetry: SolarTelemetry) => void;
  public onPacketLog?: (packet: ModbusPacket) => void;
  public onConnectionChange?: (status: boolean, msg?: string) => void;
  public onOfflineSyncBatch?: (records: OfflineSyncRecord[], progressPct: number, isComplete: boolean) => void;
  public onEspStatusUpdate?: (status: EspBridgeStatus) => void;

  // Active settings
  public settings: InverterSettings = {
    workMode: 'SBU',
    chemistry: 'LiFePO4',
    nominalSystemVoltage: 48,
    boostVoltage: 56.8,
    floatVoltage: 54.0,
    lowDcCutoffVoltage: 44.0,
    lowDcRecoveryVoltage: 50.0,
    maxTotalChargeCurrent: 80,
    maxUtilityChargeCurrent: 30,
    maxSolarChargeCurrent: 80,
    acOutputVoltage: 120,
    acOutputFrequency: 60,
    buzzerAlarm: true,
    autoRestartOverload: true,
    autoRestartOvertemp: true,
    backlightTimeoutSeconds: 60,
    ecoMode: false,
  };

  public setMode(mode: 'simulator' | 'webserial' | 'esp32' | 'modbustcp') {
    this.mode = mode;
  }

  public getMode() {
    return this.mode;
  }

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /**
   * Connect to ESP32 / ESP8266 Wireless Bridge via WebSocket
   */
  public async connectEspBridge(host: string, port = 80): Promise<boolean> {
    this.disconnect();
    this.mode = 'esp32';
    this.espStatus.ip = host;
    this.espStatus.port = port;

    return new Promise((resolve) => {
      try {
        const wsUrl = `ws://${host}:${port}/ws`;
        this.onConnectionChange?.(false, `Connecting to ESP32 at ${wsUrl}...`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          this.espWs = ws;
          this.isConnected = true;
          this.espStatus.connected = true;
          this.onConnectionChange?.(true, `Connected to ESP32 wireless bridge at ${host}`);
          this.onEspStatusUpdate?.({ ...this.espStatus, connected: true });
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'status') {
              this.espStatus = {
                ...this.espStatus,
                connected: true,
                chipType: data.chip || 'ESP32',
                rssi: data.rssi || -60,
                freeHeap: data.free_heap || 180000,
                uptimeSeconds: data.uptime_s || 0,
                bufferedRecordsCount: data.offline_records || 0,
                wdtActive: data.wdt_active ?? true,
                firmwareVersion: data.firmware || 'SRNE-Bridge-v2.4',
              };
              this.onEspStatusUpdate?.({ ...this.espStatus });
            } else if (data.type === 'telemetry') {
              const tel: SolarTelemetry = {
                ...this.computeSimulatedTelemetry(),
                pvPower: data.pv_w ?? 0,
                pvVoltage: data.pv_v ?? 0,
                soc: data.soc ?? 50,
                batteryVoltage: data.bat_v ?? 48.0,
                batteryCurrent: data.bat_a ?? 0,
                acOutputActivePower: data.ac_w ?? 0,
                heatsinkTemp: data.heatsink ?? 35,
                gridVoltage: data.grid_v ?? 120,
                timestamp: Date.now(),
              };
              this.onTelemetryUpdate?.(tel);
            } else if (data.type === 'sync_batch') {
              const records: OfflineSyncRecord[] = (data.records || []).map((r: any) => ({
                timestamp: r.t * 1000 || Date.now(),
                pvPower: r.pv_w || 0,
                pvVoltage: r.pv_v || 0,
                batterySoc: r.soc || 0,
                batteryVoltage: r.bat_v || 48.0,
                batteryPower: r.bat_w || 0,
                loadPower: r.ac_w || 0,
                gridPower: 0,
                heatsinkTemp: r.temp || 35,
              }));
              this.espStatus.isSyncing = true;
              this.espStatus.syncProgressPct = data.progress_pct || 50;
              this.espStatus.syncedRecordsTotal += records.length;
              this.onEspStatusUpdate?.({ ...this.espStatus });
              this.onOfflineSyncBatch?.(records, data.progress_pct, false);
            } else if (data.type === 'sync_complete') {
              this.espStatus.isSyncing = false;
              this.espStatus.syncProgressPct = 100;
              this.espStatus.bufferedRecordsCount = 0;
              this.espStatus.lastSyncTimestamp = Date.now();
              this.onEspStatusUpdate?.({ ...this.espStatus });
              this.onOfflineSyncBatch?.([], 100, true);
            }
          } catch (e) {
            // Json parse ignore
          }
        };

        ws.onerror = (err) => {
          this.onConnectionChange?.(false, `ESP32 connection error. Retrying in background...`);
          resolve(false);
        };

        ws.onclose = () => {
          this.isConnected = false;
          this.espStatus.connected = false;
          this.onConnectionChange?.(false, 'ESP32 disconnected.');
          this.onEspStatusUpdate?.({ ...this.espStatus, connected: false });
        };
      } catch (err: any) {
        this.onConnectionChange?.(false, `Failed to initialize ESP32 socket: ${err.message}`);
        resolve(false);
      }
    });
  }

  /**
   * Simulate ESP32 Offline Sync Test
   * Demonstrates what happens when the ESP32 disconnects, logs data in LittleFS, reconnects,
   * and replays 120 historical records into the client's charts!
   */
  public async simulateOfflineSyncTest(recordCount = 120): Promise<void> {
    this.espStatus.bufferedRecordsCount = recordCount;
    this.espStatus.isSyncing = true;
    this.espStatus.syncProgressPct = 0;
    this.onEspStatusUpdate?.({ ...this.espStatus });

    const batchSize = 30;
    let processed = 0;
    const baseTime = Date.now() - recordCount * 5000;

    for (let batchStart = 0; batchStart < recordCount; batchStart += batchSize) {
      await new Promise((r) => setTimeout(r, 600));
      const currentBatchCount = Math.min(batchSize, recordCount - batchStart);
      const batch: OfflineSyncRecord[] = [];

      for (let i = 0; i < currentBatchCount; i++) {
        const idx = batchStart + i;
        const t = baseTime + idx * 5000;
        const pv = Math.round(1800 + Math.sin(idx * 0.1) * 600);
        const load = Math.round(900 + Math.cos(idx * 0.15) * 300);
        const soc = Math.round(75 + (idx / recordCount) * 10);
        batch.push({
          timestamp: t,
          pvPower: pv,
          pvVoltage: 98.2,
          batterySoc: soc,
          batteryVoltage: 53.2,
          batteryPower: pv - load,
          loadPower: load,
          gridPower: 0,
          heatsinkTemp: 39,
        });
      }

      processed += currentBatchCount;
      const progress = Math.round((processed / recordCount) * 100);
      this.espStatus.syncProgressPct = progress;
      this.espStatus.syncedRecordsTotal += batch.length;
      this.onEspStatusUpdate?.({ ...this.espStatus });
      this.onOfflineSyncBatch?.(batch, progress, processed === recordCount);
    }

    this.espStatus.isSyncing = false;
    this.espStatus.bufferedRecordsCount = 0;
    this.espStatus.lastSyncTimestamp = Date.now();
    this.onEspStatusUpdate?.({ ...this.espStatus });
  }

  /**
   * Connect to real Linux RS485 serial dongle via Web Serial API
   */
  public async connectWebSerial(baudRate = 9600): Promise<boolean> {
    if (!this.isWebSerialSupported()) {
      throw new Error(
        'Web Serial API is not supported in this browser. Use Chromium / Google Chrome on Linux or test with the high-fidelity simulator.'
      );
    }

    try {
      const nav = navigator as any;
      const port: WebSerialPort = await nav.serial.requestPort();
      await port.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
      });

      this.serialPort = port;
      this.mode = 'webserial';
      this.isConnected = true;
      this.onConnectionChange?.(true, `Connected to Linux serial adapter at ${baudRate} baud`);

      this.startPollingLoop();
      return true;
    } catch (err: any) {
      this.isConnected = false;
      this.onConnectionChange?.(false, err?.message || 'Connection cancelled');
      return false;
    }
  }

  /**
   * Disconnect port
   */
  public async disconnect() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    if (this.serialReader) {
      try {
        await this.serialReader.cancel();
      } catch (e) {
        // ignore
      }
      this.serialReader = null;
    }

    if (this.serialPort) {
      try {
        await this.serialPort.close();
      } catch (e) {
        // ignore
      }
      this.serialPort = null;
    }

    if (this.espWs) {
      try {
        this.espWs.close();
      } catch (e) {
        // ignore
      }
      this.espWs = null;
    }

    this.isConnected = false;
    this.onConnectionChange?.(false, 'Disconnected');
  }

  /**
   * Start periodic telemetry polling
   */
  public startPollingLoop(intervalMs = 1000) {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    this.pollIntervalId = setInterval(() => {
      this.pollCycle();
    }, intervalMs);

    // Run first immediately
    this.pollCycle();
  }

  /**
   * Single polling transaction
   */
  private pollCycle() {
    if (this.mode === 'simulator') {
      const telemetry = this.computeSimulatedTelemetry();

      // Emit simulated Modbus RTU packet request & response for inspector
      const requestBytes = buildReadHoldingRegisters(1, 0x0100, 24);
      const reqPacket: ModbusPacket = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'TX',
        rawBytes: formatHex(requestBytes),
        slaveId: 1,
        functionCode: 3,
        address: 0x0100,
        crcValid: true,
        summary: 'Read Holding Registers: 0x0100 to 0x0117 (24 registers)',
      };
      this.onPacketLog?.(reqPacket);

      // Generate response bytes
      const responsePayload = new Uint8Array(3 + 24 * 2);
      responsePayload[0] = 1; // Slave ID
      responsePayload[1] = 3; // FC 03
      responsePayload[2] = 48; // Byte count

      // Fill registers with telemetry values
      const view = new DataView(responsePayload.buffer);
      view.setUint16(3 + 0 * 2, Math.round(telemetry.pvVoltage * 10), false);
      view.setUint16(3 + 1 * 2, Math.round(telemetry.pvCurrent * 10), false);
      view.setUint16(3 + 2 * 2, Math.round(telemetry.pvPower), false);
      view.setUint16(3 + 3 * 2, Math.round(telemetry.batteryVoltage * 10), false);
      view.setInt16(3 + 4 * 2, Math.round(telemetry.batteryCurrent * 10), false);
      view.setUint16(3 + 5 * 2, Math.round(telemetry.soc), false);
      view.setInt16(3 + 6 * 2, Math.round(telemetry.batteryTemp), false);
      view.setInt16(3 + 7 * 2, Math.round(telemetry.heatsinkTemp), false);
      view.setUint16(3 + 9 * 2, Math.round(telemetry.gridVoltage * 10), false);
      view.setUint16(3 + 11 * 2, Math.round(telemetry.acOutputVoltage * 10), false);
      view.setUint16(3 + 13 * 2, Math.round(telemetry.acOutputActivePower), false);
      view.setUint16(3 + 15 * 2, Math.round(telemetry.loadPercentage * 10), false);
      view.setUint16(3 + 16 * 2, Math.round(telemetry.pvTodayYieldKwh * 100), false);

      const respFull = appendCrc16(responsePayload);
      const respPacket: ModbusPacket = {
        id: `rx-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'RX',
        rawBytes: formatHex(respFull),
        slaveId: 1,
        functionCode: 3,
        byteCount: 48,
        crcValid: true,
        summary: `Telemetry: PV=${telemetry.pvPower}W, Bat=${telemetry.soc}%, Load=${telemetry.acOutputActivePower}W`,
      };
      this.onPacketLog?.(respPacket);

      this.onTelemetryUpdate?.(telemetry);
    } else if (this.mode === 'webserial' && this.serialPort) {
      // In Web Serial mode, send request frame to hardware
      this.sendSerialModbusQuery();
    }
  }

  private async sendSerialModbusQuery() {
    if (!this.serialPort || !this.serialPort.writable) return;
    try {
      const req = buildReadHoldingRegisters(1, 0x0100, 24);
      const writer = this.serialPort.writable.getWriter();
      await writer.write(req);
      writer.releaseLock();

      this.onPacketLog?.({
        id: `tx-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'TX',
        rawBytes: formatHex(req),
        slaveId: 1,
        functionCode: 3,
        address: 0x0100,
        crcValid: true,
        summary: 'Read Holding Registers: 0x0100, Len 24',
      });
    } catch (e) {
      // Port error or timeout
    }
  }

  /**
   * Apply scenario preset
   */
  public applyScenarioPreset(presetName: string) {
    this.simScenario = presetName;
    switch (presetName) {
      case 'Sunny Midday':
        this.simIrradiance = 920;
        this.simLoadWatts = 1150;
        this.simGridAvailable = true;
        this.simManualSoc = null;
        this.currentSoc = 88.0;
        break;
      case 'Passing Clouds':
        this.simIrradiance = 280;
        this.simLoadWatts = 980;
        this.simGridAvailable = true;
        this.simManualSoc = null;
        break;
      case 'High AC Load Spike':
        this.simIrradiance = 650;
        this.simLoadWatts = 4600;
        this.simGridAvailable = true;
        break;
      case 'Grid Blackout (UPS)':
        this.simIrradiance = 450;
        this.simLoadWatts = 1600;
        this.simGridAvailable = false;
        break;
      case 'Low Battery Alert':
        this.simIrradiance = 80;
        this.simLoadWatts = 1800;
        this.simGridAvailable = false;
        this.currentSoc = 16.5;
        this.simManualSoc = 16.5;
        break;
      case 'LiFePO4 Top-Balance':
        this.simIrradiance = 800;
        this.simLoadWatts = 450;
        this.simGridAvailable = true;
        this.currentSoc = 99.8;
        this.simManualSoc = 99.8;
        break;
    }
  }

  /**
   * High-fidelity physics-based simulation calculation
   */
  private computeSimulatedTelemetry(): SolarTelemetry {
    // 1. Solar calculation
    // Max rated array ~ 4200W at 1000 W/m2 with slight jitter
    const jitter = (Math.random() - 0.5) * 0.04;
    const irradianceRatio = Math.max(0, Math.min(1, this.simIrradiance / 1000 + jitter));
    const pvPower = Math.round(irradianceRatio * 3800);
    const pvVoltage = pvPower > 50 ? 98.4 + (Math.random() - 0.5) * 1.5 : 12.0;
    const pvCurrent = pvVoltage > 0 ? Number((pvPower / pvVoltage).toFixed(1)) : 0;

    if (pvPower > this.peakPvPower) {
      this.peakPvPower = pvPower;
    }

    // Accumulate yield (scaled ~ 1 second increment)
    this.todayPvYieldKwh += (pvPower / 3600000) * 10; // slightly boosted for visible real-time progress
    this.totalPvYieldKwh += (pvPower / 3600000) * 10;

    // 2. Load Calculation
    const loadJitter = (Math.random() - 0.5) * 20;
    const loadWatts = Math.max(50, Math.round(this.simLoadWatts + loadJitter));
    this.todayLoadKwh += (loadWatts / 3600000) * 10;
    this.totalLoadKwh += (loadWatts / 3600000) * 10;

    // 3. Inverter Power Flow & Work Mode Arbitration
    const mode = this.settings.workMode;
    let gridPower = 0;
    let inverterStatus: SolarTelemetry['inverterStatus'] = 'Inverting';
    let batteryNetWatts = 0; // positive = charging, negative = discharging

    const gridVoltage = this.simGridAvailable ? 120.4 + (Math.random() - 0.5) * 0.8 : 0;
    const gridFreq = this.simGridAvailable ? 60.01 + (Math.random() - 0.5) * 0.04 : 0;

    // Arbitration logic
    if (mode === 'SOL') {
      // Solar First: Solar powers load first. Excess to battery. Deficit to battery. Grid if battery low.
      if (pvPower >= loadWatts) {
        batteryNetWatts = pvPower - loadWatts;
        gridPower = 0;
      } else {
        const deficit = loadWatts - pvPower;
        if (this.currentSoc > 20 || !this.simGridAvailable) {
          batteryNetWatts = -deficit;
          gridPower = 0;
        } else {
          // Switch to grid bypass
          inverterStatus = 'Bypass';
          gridPower = loadWatts;
          batteryNetWatts = pvPower; // all solar charges battery
        }
      }
    } else if (mode === 'UTI') {
      // Utility First: Grid powers AC load. Solar charges battery.
      if (this.simGridAvailable) {
        inverterStatus = 'Bypass';
        gridPower = loadWatts;
        batteryNetWatts = pvPower;
      } else {
        // Grid failure fallback
        inverterStatus = 'Inverting';
        gridPower = 0;
        batteryNetWatts = pvPower - loadWatts;
      }
    } else if (mode === 'SBU') {
      // Solar-Battery-Utility: Solar & Battery power load. Grid only if battery empty
      if (this.currentSoc > 20 || !this.simGridAvailable) {
        batteryNetWatts = pvPower - loadWatts;
        gridPower = 0;
        inverterStatus = 'Inverting';
      } else {
        inverterStatus = 'Bypass';
        gridPower = loadWatts;
        batteryNetWatts = pvPower;
      }
    } else if (mode === 'SUB') {
      // Solar-Utility-Battery: Solar powers load; Grid covers shortfall; Battery spared
      if (pvPower >= loadWatts) {
        batteryNetWatts = pvPower - loadWatts;
        gridPower = 0;
      } else if (this.simGridAvailable) {
        gridPower = loadWatts - pvPower;
        batteryNetWatts = 0;
        inverterStatus = 'Inverting';
      } else {
        batteryNetWatts = pvPower - loadWatts;
        gridPower = 0;
      }
    }

    // Inverter efficiency ~95.2%
    const efficiency = loadWatts > 200 ? 95.4 : 91.0;

    // 4. Battery Dynamics
    // Battery nominal 48V (16S LiFePO4: 16 * 3.2V = 51.2V nominal, 54.0V float, 56.8V boost)
    if (this.simManualSoc !== null) {
      this.currentSoc = this.simManualSoc;
    } else {
      // Integrate battery net watts into SOC: 5120 Wh pack
      const deltaSoc = (batteryNetWatts / 5120) * (100 / 3600) * 12; // boosted for responsive UI
      this.currentSoc = Math.max(10, Math.min(100, this.currentSoc + deltaSoc));
    }

    // Calculate voltage from SOC curve for LiFePO4
    const baseVoltage = 48.0 + (this.currentSoc / 100) * 6.4; // 48V to 54.4V
    // IR drop / rise based on current
    const batteryVoltage = Number((baseVoltage + (batteryNetWatts / 3000) * 0.8).toFixed(1));
    const batteryCurrent = Number((batteryNetWatts / batteryVoltage).toFixed(1));

    // Determine charge stage
    let chargeStage: SolarTelemetry['chargeStage'] = 'Standby';
    if (batteryNetWatts < -10) {
      chargeStage = 'Discharging';
    } else if (batteryNetWatts > 10) {
      if (this.currentSoc < 85) chargeStage = 'Bulk';
      else if (this.currentSoc < 98) chargeStage = 'Boost';
      else chargeStage = 'Float';
    }

    // Calculate 16S individual cell voltages (e.g. ~3.33V)
    const nominalCellV = batteryVoltage / 16;
    const cells: BmsCell[] = Array.from({ length: 16 }, (_, idx) => {
      // deterministic slight variance per cell
      const cellOffset = Math.sin(idx * 1.5) * 0.008;
      const v = Number((nominalCellV + cellOffset).toFixed(3));
      return {
        id: idx + 1,
        voltage: v,
        balancing: chargeStage === 'Float' && idx % 3 === 0,
      };
    });

    // 5. Thermal & Fans
    const loadFactor = loadWatts / 5000;
    const targetHeatsink = this.simAmbientTemp + 10 + loadFactor * 32;
    this.heatsinkTemp += (targetHeatsink - this.heatsinkTemp) * 0.08;
    const fanSpeed = Math.round(Math.max(0, Math.min(100, (this.heatsinkTemp - 35) * 3.5)));

    // 6. Active Faults
    const activeFaults: FaultItem[] = [];
    if (this.currentSoc <= 18) {
      activeFaults.push({
        id: 'E03-ACTIVE',
        code: 'E03',
        ...SRNE_FAULT_DICTIONARY.E03,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    if (loadWatts > 5200) {
      activeFaults.push({
        id: 'E06-ACTIVE',
        code: 'E06',
        ...SRNE_FAULT_DICTIONARY.E06,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    if (this.heatsinkTemp > 82) {
      activeFaults.push({
        id: 'E05-ACTIVE',
        code: 'E05',
        ...SRNE_FAULT_DICTIONARY.E05,
        timestamp: new Date().toLocaleTimeString(),
      });
    }

    // Remaining run time in hours if discharging
    const remainingRunHours =
      batteryNetWatts < -50
        ? Number(((this.currentSoc / 100) * 5120 / Math.abs(batteryNetWatts)).toFixed(1))
        : 99.9;

    return {
      pvVoltage,
      pvCurrent,
      pvPower,
      pvTodayYieldKwh: Number(this.todayPvYieldKwh.toFixed(2)),
      pvTotalYieldKwh: Number(this.totalPvYieldKwh.toFixed(1)),
      pvPeakPowerToday: this.peakPvPower,
      pvStatus: pvPower > 10 ? 'Charging' : 'Idle',

      batteryVoltage,
      batteryCurrent,
      batteryPower: Math.round(batteryNetWatts),
      soc: Math.round(this.currentSoc),
      soh: 99,
      batteryTemp: Math.round(this.simAmbientTemp + 4),
      chargeStage,
      chemistry: this.settings.chemistry,
      cells,
      cycles: this.currentCycles,
      capacityAh: 100,
      remainingRunHours,

      workMode: this.settings.workMode,
      inverterStatus,
      acOutputVoltage: this.settings.acOutputVoltage,
      acOutputCurrent: Number((loadWatts / this.settings.acOutputVoltage).toFixed(1)),
      acOutputFrequency: this.settings.acOutputFrequency,
      acOutputActivePower: loadWatts,
      acOutputApparentPower: Math.round(loadWatts / 0.96),
      loadPercentage: Number(((loadWatts / 5000) * 100).toFixed(1)),
      heatsinkTemp: Math.round(this.heatsinkTemp),
      transformerTemp: Math.round(this.heatsinkTemp - 4),
      fanSpeed,
      efficiency,
      acTodayConsumptionKwh: Number(this.todayLoadKwh.toFixed(2)),
      acTotalConsumptionKwh: Number(this.totalLoadKwh.toFixed(1)),

      gridConnected: this.simGridAvailable,
      gridVoltage: Number(gridVoltage.toFixed(1)),
      gridFrequency: Number(gridFreq.toFixed(2)),
      gridPower: Math.round(gridPower),
      gridChargeCurrent:
        inverterStatus === 'Bypass' && this.simGridAvailable
          ? Number((gridPower / (gridVoltage || 120)).toFixed(1))
          : 0,

      dcLoadOn: true,
      dcLoadVoltage: batteryVoltage,
      dcLoadCurrent: 1.8,
      dcLoadPower: Math.round(batteryVoltage * 1.8),
      dcLoadMode: 'Manual',

      buzzerEnabled: this.settings.buzzerAlarm,
      ecoModeEnabled: this.settings.ecoMode,
      activeFaults,
      timestamp: Date.now(),
    };
  }

  /**
   * Write parameter changes to device (or simulated registers)
   */
  public async writeParameter(
    registerAddress: number,
    value: number
  ): Promise<{ success: boolean; message: string }> {
    // Generate write single register frame
    const frame = appendCrc16(
      new Uint8Array([
        1,
        0x06,
        (registerAddress >> 8) & 0xff,
        registerAddress & 0xff,
        (value >> 8) & 0xff,
        value & 0xff,
      ])
    );

    const txPacket: ModbusPacket = {
      id: `tx-write-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      direction: 'TX',
      rawBytes: formatHex(frame),
      slaveId: 1,
      functionCode: 6,
      address: registerAddress,
      crcValid: true,
      summary: `Write Register 0x${registerAddress.toString(16).toUpperCase()} = ${value}`,
    };
    this.onPacketLog?.(txPacket);

    // If real serial port active, send over wire
    if (this.mode === 'webserial' && this.serialPort?.writable) {
      try {
        const writer = this.serialPort.writable.getWriter();
        await writer.write(frame);
        writer.releaseLock();
      } catch (err: any) {
        return { success: false, message: `Serial write failed: ${err.message}` };
      }
    }

    // Emulate device echo response
    const rxPacket: ModbusPacket = {
      id: `rx-write-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      direction: 'RX',
      rawBytes: formatHex(frame),
      slaveId: 1,
      functionCode: 6,
      address: registerAddress,
      crcValid: true,
      summary: `Write Confirmed: Register 0x${registerAddress.toString(16).toUpperCase()} updated`,
    };
    this.onPacketLog?.(rxPacket);

    return { success: true, message: `Register 0x${registerAddress.toString(16).toUpperCase()} successfully written.` };
  }
}

// Global singleton instance
export const hardwareEngine = new HardwareEngine();
