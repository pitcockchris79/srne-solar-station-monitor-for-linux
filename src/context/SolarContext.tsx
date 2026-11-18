/**
 * SolarContext: Central state management for SRNE Solar Station Monitor
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ConnectionMode,
  ConnectionStatus,
  EspBridgeStatus,
  FaultItem,
  HistoryPoint,
  InverterSettings,
  ModbusPacket,
  OfflineSyncRecord,
  SerialConfig,
  SolarTelemetry,
} from '../types/srne';
import { hardwareEngine } from '../utils/hardwareEngine';
import { appendCrc16, formatHex } from '../utils/modbus';

interface SolarContextType {
  telemetry: SolarTelemetry | null;
  history: HistoryPoint[];
  packets: ModbusPacket[];
  connectionMode: ConnectionMode;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  serialConfig: SerialConfig;
  pollingRateMs: number;
  isBuzzerMuted: boolean;
  settings: InverterSettings;
  activeScenario: string;
  isWebSerialSupported: boolean;
  espStatus: EspBridgeStatus;

  // Actions
  setConnectionMode: (mode: ConnectionMode) => void;
  setPollingRateMs: (rateMs: number) => void;
  updateSerialConfig: (cfg: Partial<SerialConfig>) => void;
  connectSerial: () => Promise<void>;
  connectEspBridge: (host: string, port?: number) => Promise<boolean>;
  simulateOfflineSync: (recordCount?: number) => Promise<void>;
  disconnect: () => Promise<void>;
  applyScenarioPreset: (name: string) => void;
  setSimIrradiance: (w: number) => void;
  setSimSoc: (soc: number | null) => void;
  setSimLoadWatts: (w: number) => void;
  toggleSimGrid: () => void;
  toggleBuzzerMute: () => void;
  saveSettings: (newSettings: InverterSettings) => Promise<boolean>;
  sendCustomModbusFrame: (
    slaveId: number,
    fc: number,
    address: number,
    value: number
  ) => Promise<void>;
  clearPackets: () => void;
  exportCsvData: () => void;
}

const SolarContext = createContext<SolarContextType | null>(null);

export const SolarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telemetry, setTelemetry] = useState<SolarTelemetry | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [packets, setPackets] = useState<ModbusPacket[]>([]);
  const [connectionMode, setConnectionModeState] = useState<ConnectionMode>('simulator');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [statusMessage, setStatusMessage] = useState('Hardware Simulator Active (9600-8N1)');
  const [pollingRateMs, setPollingRateMsState] = useState(1000);
  const [isBuzzerMuted, setIsBuzzerMuted] = useState(false);
  const [settings, setSettings] = useState<InverterSettings>(hardwareEngine.settings);
  const [activeScenario, setActiveScenario] = useState('Sunny Midday');
  const [isWebSerialSupported, setIsWebSerialSupported] = useState(false);
  const [espStatus, setEspStatus] = useState<EspBridgeStatus>(hardwareEngine.espStatus);

  const [serialConfig, setSerialConfig] = useState<SerialConfig>({
    port: '/dev/ttyUSB0',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    slaveId: 1,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Check Web Serial support
  useEffect(() => {
    setIsWebSerialSupported(hardwareEngine.isWebSerialSupported());
  }, []);

  // Web Audio buzzer for active faults
  const playBuzzerBeep = () => {
    if (isBuzzerMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current && AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      if (audioCtxRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.15);
      }
    } catch (e) {
      // Audio autoplay policy catch
    }
  };

  // Wire up HardwareEngine listeners
  useEffect(() => {
    hardwareEngine.onTelemetryUpdate = (data: SolarTelemetry) => {
      setTelemetry(data);

      // Append to rolling history (keep latest 120 points)
      setHistory((prev) => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newPoint: HistoryPoint = {
          time: timeStr,
          timestamp: Date.now(),
          pvPower: data.pvPower,
          loadPower: data.acOutputActivePower,
          batteryPower: data.batteryPower,
          batterySoc: data.soc,
          gridPower: data.gridPower,
          heatsinkTemp: data.heatsinkTemp,
        };
        const updated = [...prev, newPoint];
        return updated.length > 120 ? updated.slice(updated.length - 120) : updated;
      });

      // Sound buzzer if active fault and enabled
      if (data.activeFaults.length > 0 && data.buzzerEnabled) {
        playBuzzerBeep();
      }
    };

    hardwareEngine.onPacketLog = (pkt: ModbusPacket) => {
      setPackets((prev) => {
        const next = [pkt, ...prev];
        return next.length > 150 ? next.slice(0, 150) : next;
      });
    };

    hardwareEngine.onConnectionChange = (connected: boolean, msg?: string) => {
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      if (msg) setStatusMessage(msg);
    };

    hardwareEngine.onEspStatusUpdate = (status: EspBridgeStatus) => {
      setEspStatus({ ...status });
    };

    hardwareEngine.onOfflineSyncBatch = (records: OfflineSyncRecord[], progressPct: number, isComplete: boolean) => {
      if (records.length > 0) {
        setHistory((prev) => {
          const newPoints: HistoryPoint[] = records.map((r) => {
            const d = new Date(r.timestamp);
            return {
              time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              timestamp: r.timestamp,
              pvPower: r.pvPower,
              loadPower: r.loadPower,
              batteryPower: r.batteryPower,
              batterySoc: r.batterySoc,
              gridPower: r.gridPower,
              heatsinkTemp: r.heatsinkTemp,
            };
          });

          const merged = [...prev, ...newPoints];
          merged.sort((a, b) => a.timestamp - b.timestamp);
          return merged.length > 250 ? merged.slice(merged.length - 250) : merged;
        });
      }
      if (isComplete) {
        setStatusMessage('Offline flash sync completed: telemetry history seamlessly backfilled.');
      }
    };

    // Initialize with default rolling history so charts look alive immediately
    const initialHistory: HistoryPoint[] = [];
    const baseTime = Date.now() - 60 * 1000;
    for (let i = 0; i < 30; i++) {
      const t = new Date(baseTime + i * 2000);
      initialHistory.push({
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: t.getTime(),
        pvPower: Math.round(2800 + Math.sin(i * 0.2) * 200),
        loadPower: Math.round(1100 + Math.cos(i * 0.3) * 150),
        batteryPower: Math.round(1600 + Math.sin(i * 0.2) * 100),
        batterySoc: 84,
        gridPower: 0,
        heatsinkTemp: 38,
      });
    }
    setHistory(initialHistory);

    hardwareEngine.startPollingLoop(pollingRateMs);

    return () => {
      hardwareEngine.disconnect();
    };
  }, []);

  const setConnectionMode = (mode: ConnectionMode) => {
    setConnectionModeState(mode);
    hardwareEngine.setMode(mode);
    if (mode === 'simulator') {
      setConnectionStatus('connected');
      setStatusMessage('Hardware Simulator Active (9600-8N1)');
    } else {
      setConnectionStatus('disconnected');
      setStatusMessage(`Ready to connect via ${mode === 'webserial' ? 'Linux Serial (/dev/ttyUSB)' : 'Modbus TCP'}`);
    }
  };

  const setPollingRateMs = (rateMs: number) => {
    setPollingRateMsState(rateMs);
    hardwareEngine.startPollingLoop(rateMs);
  };

  const updateSerialConfig = (cfg: Partial<SerialConfig>) => {
    setSerialConfig((prev) => ({ ...prev, ...cfg }));
  };

  const connectSerial = async () => {
    setConnectionStatus('connecting');
    setStatusMessage('Selecting Linux serial device via Web Serial API...');
    try {
      const ok = await hardwareEngine.connectWebSerial(serialConfig.baudRate);
      if (ok) {
        setConnectionStatus('connected');
        setConnectionModeState('webserial');
        setStatusMessage(`Connected to ${serialConfig.port} @ ${serialConfig.baudRate} baud`);
      } else {
        setConnectionStatus('disconnected');
        setStatusMessage('Port connection closed or cancelled');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setStatusMessage(err?.message || 'Failed to open serial port');
    }
  };

  const disconnect = async () => {
    await hardwareEngine.disconnect();
    setConnectionStatus('disconnected');
    setStatusMessage('Port disconnected');
  };

  const connectEspBridge = async (host: string, port = 80): Promise<boolean> => {
    setConnectionModeState('esp32');
    setConnectionStatus('connecting');
    setStatusMessage(`Connecting to ESP32 wireless bridge at ${host}:${port}...`);
    const ok = await hardwareEngine.connectEspBridge(host, port);
    if (ok) {
      setConnectionStatus('connected');
      setStatusMessage(`Connected to ESP32 at ${host}:${port} (Live Telemetry & Sync Active)`);
    } else {
      setConnectionStatus('error');
      setStatusMessage(`Failed to connect to ESP32 at ${host}:${port}. Verify WiFi network & IP.`);
    }
    return ok;
  };

  const simulateOfflineSync = async (recordCount = 120): Promise<void> => {
    await hardwareEngine.simulateOfflineSyncTest(recordCount);
  };

  const applyScenarioPreset = (name: string) => {
    setActiveScenario(name);
    hardwareEngine.applyScenarioPreset(name);
  };

  const setSimIrradiance = (w: number) => {
    hardwareEngine.simIrradiance = w;
  };

  const setSimSoc = (soc: number | null) => {
    hardwareEngine.simManualSoc = soc;
  };

  const setSimLoadWatts = (w: number) => {
    hardwareEngine.simLoadWatts = w;
  };

  const toggleSimGrid = () => {
    hardwareEngine.simGridAvailable = !hardwareEngine.simGridAvailable;
  };

  const toggleBuzzerMute = () => {
    setIsBuzzerMuted((prev) => !prev);
  };

  const saveSettings = async (newSettings: InverterSettings): Promise<boolean> => {
    hardwareEngine.settings = newSettings;
    setSettings({ ...newSettings });

    // Emulate writing key holding registers
    const modeMap = { SOL: 0, UTI: 1, SBU: 2, SUB: 3 };
    await hardwareEngine.writeParameter(0xE004, modeMap[newSettings.workMode]);
    await hardwareEngine.writeParameter(0xE008, Math.round(newSettings.boostVoltage * 10));
    await hardwareEngine.writeParameter(0xE009, Math.round(newSettings.floatVoltage * 10));
    await hardwareEngine.writeParameter(0xE00A, Math.round(newSettings.lowDcCutoffVoltage * 10));
    await hardwareEngine.writeParameter(0xE00E, newSettings.maxTotalChargeCurrent);
    return true;
  };

  const sendCustomModbusFrame = async (
    slaveId: number,
    fc: number,
    address: number,
    value: number
  ) => {
    if (fc === 3) {
      // Read
      const bytes = appendCrc16(
        new Uint8Array([
          slaveId,
          0x03,
          (address >> 8) & 0xff,
          address & 0xff,
          (value >> 8) & 0xff,
          value & 0xff,
        ])
      );
      hardwareEngine.onPacketLog?.({
        id: `tx-custom-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'TX',
        rawBytes: formatHex(bytes),
        slaveId,
        functionCode: 3,
        address,
        crcValid: true,
        summary: `Custom Query: Read Reg 0x${address.toString(16).toUpperCase()} Count=${value}`,
      });
    } else if (fc === 6) {
      // Write
      await hardwareEngine.writeParameter(address, value);
    }
  };

  const clearPackets = () => {
    setPackets([]);
  };

  const exportCsvData = () => {
    if (history.length === 0) return;
    const headers = 'Timestamp,Time,Solar_Power_W,Load_Power_W,Battery_Power_W,Battery_SOC_Pct,Grid_Power_W,Heatsink_Temp_C\n';
    const rows = history
      .map(
        (h) =>
          `${h.timestamp},"${h.time}",${h.pvPower},${h.loadPower},${h.batteryPower},${h.batterySoc},${h.gridPower},${h.heatsinkTemp}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `srne_telemetry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <SolarContext.Provider
      value={{
        telemetry,
        history,
        packets,
        connectionMode,
        connectionStatus,
        statusMessage,
        serialConfig,
        pollingRateMs,
        isBuzzerMuted,
        settings,
        activeScenario,
        isWebSerialSupported,
        espStatus,
        setConnectionMode,
        setPollingRateMs,
        updateSerialConfig,
        connectSerial,
        connectEspBridge,
        simulateOfflineSync,
        disconnect,
        applyScenarioPreset,
        setSimIrradiance,
        setSimSoc,
        setSimLoadWatts,
        toggleSimGrid,
        toggleBuzzerMute,
        saveSettings,
        sendCustomModbusFrame,
        clearPackets,
        exportCsvData,
      }}
    >
      {children}
    </SolarContext.Provider>
  );
};

export const useSolar = () => {
  const ctx = useContext(SolarContext);
  if (!ctx) {
    throw new Error('useSolar must be used within a SolarProvider');
  }
  return ctx;
};
