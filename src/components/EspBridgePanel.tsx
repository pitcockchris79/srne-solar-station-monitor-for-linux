/**
 * ESP32 & ESP8266 Wireless Bridge & Offline Sync Console
 * Live WebSocket client, LittleFS flash sync monitor, and interactive firmware builder.
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  Cable,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  FileCode,
  HardDrive,
  Play,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Signal,
  Sliders,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';
import {
  DEFAULT_FIRMWARE_CONFIG,
  FirmwareConfig,
  generateEsp32Firmware,
  generateEsp8266Firmware,
  generatePlatformIoIni,
} from '../utils/espFirmwareGenerator';

export const EspBridgePanel: React.FC = () => {
  const {
    espStatus,
    connectEspBridge,
    disconnect,
    simulateOfflineSync,
    connectionMode,
  } = useSolar();

  // Firmware configurator state
  const [fwConfig, setFwConfig] = useState<FirmwareConfig>(DEFAULT_FIRMWARE_CONFIG);
  const [activeCodeTab, setActiveCodeTab] = useState<'firmware' | 'platformio' | 'wiring'>('firmware');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Connection form state
  const [targetIp, setTargetIp] = useState('192.168.1.185');
  const [targetPort, setTargetPort] = useState(80);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSimulatingSync, setIsSimulatingSync] = useState(false);

  const isConnected = connectionMode === 'esp32' && espStatus.connected;

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectEspBridge(targetIp, targetPort);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSimulateSyncTest = async () => {
    setIsSimulatingSync(true);
    try {
      await simulateOfflineSync(120);
    } finally {
      setIsSimulatingSync(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const activeFirmwareCode =
    fwConfig.chip === 'ESP32'
      ? generateEsp32Firmware(fwConfig)
      : generateEsp8266Firmware(fwConfig);

  const platformIoCode = generatePlatformIoIni(fwConfig.chip);

  const handleDownloadIno = () => {
    const filename = fwConfig.chip === 'ESP32' ? 'srne_esp32_firmware.ino' : 'srne_esp8266_firmware.ino';
    const blob = new Blob([activeFirmwareCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Live Wireless Bridge & Offline Sync Status Strip */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                ESP32 / ESP8266 Wireless Telemetry Bridge
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-time bidirectional WebSocket telemetry with LittleFS flash queue for offline reconnection sync.
              </p>
            </div>
          </div>

          {/* Quick Connect Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
              <span className="text-[11px] font-mono text-slate-500 mr-2">ws://</span>
              <input
                type="text"
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
                placeholder="192.168.1.185 or hostname"
                className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-36"
              />
              <span className="text-slate-600 mx-1">:</span>
              <input
                type="number"
                value={targetPort}
                onChange={(e) => setTargetPort(Number(e.target.value))}
                className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-10 text-center"
              />
            </div>

            {isConnected ? (
              <button
                onClick={disconnect}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-3.5 py-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5" />
                    Connect Bridge
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Live Hardware Telemetry & LittleFS Queue Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-800/80 text-xs">
          <div>
            <div className="text-slate-400">Bridge Status</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-1 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {isConnected ? `${espStatus.chipType} Online` : 'Standby / Ready'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              IP: {targetIp}
            </div>
          </div>

          <div>
            <div className="text-slate-400">WiFi RSSI & Link Quality</div>
            <div className="text-sm font-bold font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
              <Signal className="w-3.5 h-3.5" />
              {espStatus.rssi} dBm
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              {espStatus.rssi > -65 ? 'Excellent 98%' : 'Good 82%'} · No-Sleep
            </div>
          </div>

          <div>
            <div className="text-slate-400">Watchdog & Free Heap</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              {Math.round(espStatus.freeHeap / 1024)} KB Free
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              WDT Active (30s auto-reset)
            </div>
          </div>

          <div>
            <div className="text-slate-400">LittleFS Flash Queue (Offline Buffer)</div>
            <div className="text-sm font-bold font-mono text-amber-400 mt-1 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              {espStatus.bufferedRecordsCount} records queued
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              {espStatus.isSyncing ? `Syncing ${espStatus.syncProgressPct}%...` : 'Flash Storage: 1.5MB Partition'}
            </div>
          </div>
        </div>

        {/* Offline Sync Status & Simulation Benchmark */}
        <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span className="font-semibold text-amber-400">Disconnection Resilience Engine:</span>
            <span>
              If WiFi drops, the ESP continues logging to LittleFS flash every {fwConfig.offlineLogIntervalMs / 1000}s.
              When reconnected, records stream seamlessly into client charts.
            </span>
          </div>

          <button
            onClick={handleSimulateSyncTest}
            disabled={isSimulatingSync}
            className="px-3.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSimulatingSync ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                Syncing 120 Offline Records ({espStatus.syncProgressPct}%)...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-amber-400" />
                Test Offline Sync Replay (120 Records)
              </>
            )}
          </button>
        </div>

        {/* Sync Progress Bar */}
        {(espStatus.isSyncing || isSimulatingSync) && (
          <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-amber-500/30">
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Streaming backlog records from LittleFS to client...</span>
              <span className="font-mono text-amber-400 font-semibold">{espStatus.syncProgressPct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${espStatus.syncProgressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Firmware Configurator & Code Generator */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-amber-400" />
              Rock-Solid ESP32 / ESP8266 Firmware Generator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize your WiFi credentials and pinouts, then copy or download production-ready C++ code.
            </p>
          </div>

          {/* Chip Architecture Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFwConfig({ ...fwConfig, chip: 'ESP32', rxPin: 16, txPin: 17, deRePin: 4 })}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                fwConfig.chip === 'ESP32'
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ESP32 (Recommended)
            </button>
            <button
              onClick={() => setFwConfig({ ...fwConfig, chip: 'ESP8266', rxPin: 13, txPin: 15, deRePin: 12 })}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                fwConfig.chip === 'ESP8266'
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ESP8266 (NodeMCU / D1)
            </button>
          </div>
        </div>

        {/* Configuration Parameters Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 my-5 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">WiFi Network SSID</label>
            <input
              type="text"
              value={fwConfig.wifiSsid}
              onChange={(e) => setFwConfig({ ...fwConfig, wifiSsid: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">WiFi Password</label>
            <input
              type="text"
              value={fwConfig.wifiPass}
              onChange={(e) => setFwConfig({ ...fwConfig, wifiPass: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">RS485 Baud Rate</label>
            <select
              value={fwConfig.baudRate}
              onChange={(e) => setFwConfig({ ...fwConfig, baudRate: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value={9600}>9600 baud (SRNE Factory Standard)</option>
              <option value={4800}>4800 baud</option>
              <option value={19200}>19200 baud</option>
              <option value={115200}>115200 baud</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Offline Log Cadence</label>
            <select
              value={fwConfig.offlineLogIntervalMs}
              onChange={(e) => setFwConfig({ ...fwConfig, offlineLogIntervalMs: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value={2000}>Every 2 seconds (Fast)</option>
              <option value={5000}>Every 5 seconds (Optimal ~42 hrs buffer)</option>
              <option value={10000}>Every 10 seconds (Extended ~84 hrs buffer)</option>
            </select>
          </div>
        </div>

        {/* Code Tabs Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pt-2 pb-2">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setActiveCodeTab('firmware')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeCodeTab === 'firmware'
                  ? 'bg-slate-800 text-amber-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {fwConfig.chip === 'ESP32' ? 'srne_esp32_firmware.ino' : 'srne_esp8266_firmware.ino'}
            </button>

            <button
              onClick={() => setActiveCodeTab('platformio')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeCodeTab === 'platformio'
                  ? 'bg-slate-800 text-amber-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              platformio.ini
            </button>

            <button
              onClick={() => setActiveCodeTab('wiring')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeCodeTab === 'wiring'
                  ? 'bg-slate-800 text-amber-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hardware Wiring Schematics
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadIno}
              className="px-3 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              Download .ino
            </button>

            <button
              onClick={() =>
                handleCopy(
                  activeCodeTab === 'firmware'
                    ? activeFirmwareCode
                    : activeCodeTab === 'platformio'
                    ? platformIoCode
                    : 'See Wiring Guide',
                  activeCodeTab
                )
              }
              className="px-3 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors flex items-center gap-1.5"
            >
              {copiedKey === activeCodeTab ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedKey === activeCodeTab ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* Code Content View */}
        {activeCodeTab === 'firmware' && (
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-[460px] leading-relaxed mt-3">
            {activeFirmwareCode}
          </pre>
        )}

        {activeCodeTab === 'platformio' && (
          <div className="space-y-3 mt-3">
            <p className="text-xs text-slate-400">
              Put this in your PlatformIO project root as <code>platformio.ini</code>:
            </p>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-[460px] leading-relaxed">
              {platformIoCode}
            </pre>
          </div>
        )}

        {activeCodeTab === 'wiring' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                ESP32 & MAX485 Pinout Connections
              </h4>
              <div className="font-mono text-[11px] space-y-1.5 text-slate-300">
                <div className="flex justify-between border-b border-slate-800/80 pb-1">
                  <span>MAX485 RO (Receiver Out)</span>
                  <span className="text-amber-400 font-bold">&rarr; ESP32 GPIO 16 (RX2)</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-1">
                  <span>MAX485 DI (Driver In)</span>
                  <span className="text-amber-400 font-bold">&rarr; ESP32 GPIO 17 (TX2)</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-1">
                  <span>MAX485 DE & RE (Tied together)</span>
                  <span className="text-amber-400 font-bold">&rarr; ESP32 GPIO 4 (Direction)</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-1">
                  <span>MAX485 VCC & GND</span>
                  <span className="text-slate-400">&rarr; 3.3V or 5V & GND</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                <Cable className="w-4 h-4 text-cyan-400" />
                SRNE RJ45 Modbus RS485 Pinout
              </h4>
              <div className="font-mono text-[11px] space-y-1.5 text-slate-300">
                <div className="flex justify-between border-b border-slate-800/80 pb-1">
                  <span>RJ45 Pin 1 & 2 (Orange Stripe / Orange)</span>
                  <span className="text-emerald-400 font-bold">&rarr; MAX485 Pin A (+)</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-1">
                  <span>RJ45 Pin 7 & 8 (Brown Stripe / Brown)</span>
                  <span className="text-emerald-400 font-bold">&rarr; MAX485 Pin B (-)</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-1">
                  <span>RJ45 Pin 5 (Blue Stripe)</span>
                  <span className="text-slate-400 font-bold">&rarr; Common Signal Ground (GND)</span>
                </div>
                <div className="pt-1 text-slate-400 text-[10px]">
                  Note: A 120&Omega; termination resistor across A & B is recommended for runs &gt;10 meters.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
