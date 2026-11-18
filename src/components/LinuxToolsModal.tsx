/**
 * Linux Connection & Headless Daemon Integration Modal
 * Provides direct Web Serial hardware connection and one-click Linux daemon/systemd generators.
 */

import React, { useState } from 'react';
import {
  Cable,
  Check,
  Copy,
  Cpu,
  FileCode,
  HardDrive,
  RefreshCw,
  Server,
  Terminal,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';
import {
  generateHomeAssistantYaml,
  generateLinuxDaemonPython,
  generateSystemdUnit,
} from '../utils/modbus';

interface LinuxToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LinuxToolsModal: React.FC<LinuxToolsModalProps> = ({ isOpen, onClose }) => {
  const {
    connectionMode,
    connectionStatus,
    statusMessage,
    serialConfig,
    updateSerialConfig,
    connectSerial,
    disconnect,
    setConnectionMode,
    isWebSerialSupported,
    connectEspBridge,
    espStatus,
  } = useSolar();

  const [activeTab, setActiveTab] = useState<'serial' | 'python' | 'systemd' | 'homeassistant' | 'esp'>('serial');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const pythonScript = generateLinuxDaemonPython(
    serialConfig.port,
    serialConfig.baudRate,
    serialConfig.slaveId
  );
  const systemdScript = generateSystemdUnit();
  const haYaml = generateHomeAssistantYaml();

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cable className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Linux Serial & Hardware Integration
              </h3>
              <p className="text-xs text-slate-400">
                Direct RS485 USB communication & headless daemon scripts for Linux / Raspberry Pi.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-5 gap-1 text-xs">
          <button
            onClick={() => setActiveTab('serial')}
            className={`py-3 px-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'serial'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Serial Connection
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`py-3 px-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'python'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            srne-daemon.py
          </button>

          <button
            onClick={() => setActiveTab('systemd')}
            className={`py-3 px-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'systemd'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            systemd Unit
          </button>

          <button
            onClick={() => setActiveTab('homeassistant')}
            className={`py-3 px-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'homeassistant'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Home Assistant MQTT
          </button>

          <button
            onClick={() => setActiveTab('esp')}
            className={`py-3 px-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'esp'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            ESP32 / WiFi Bridge
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {activeTab === 'serial' && (
            <div className="space-y-5">
              {/* Connection Status Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Current Interface Mode:</div>
                  <div className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'
                      }`}
                    />
                    {connectionMode === 'simulator'
                      ? 'High-Fidelity Hardware Simulator'
                      : `Hardware Serial (${serialConfig.port})`}
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">{statusMessage}</div>
                </div>

                <div className="flex gap-2">
                  {connectionMode !== 'simulator' && (
                    <button
                      onClick={() => setConnectionMode('simulator')}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                    >
                      Use Simulator
                    </button>
                  )}
                  {connectionStatus === 'connected' && connectionMode === 'webserial' ? (
                    <button
                      onClick={disconnect}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={connectSerial}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Cable className="w-3.5 h-3.5" />
                      Connect USB / RS485 Dongle
                    </button>
                  )}
                </div>
              </div>

              {/* Linux Serial Port Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Linux Device Port Path
                  </label>
                  <select
                    value={serialConfig.port}
                    onChange={(e) => updateSerialConfig({ port: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="/dev/ttyUSB0">/dev/ttyUSB0 (Standard FTDI/CH340)</option>
                    <option value="/dev/ttyUSB1">/dev/ttyUSB1 (Secondary Adapter)</option>
                    <option value="/dev/ttyACM0">/dev/ttyACM0 (CDC-ACM Adapter)</option>
                    <option value="/dev/serial0">/dev/serial0 (Raspberry Pi GPIO UART)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Baud Rate (SRNE Standard)</label>
                  <select
                    value={serialConfig.baudRate}
                    onChange={(e) =>
                      updateSerialConfig({ baudRate: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={9600}>9600 baud (Default Factory Standard)</option>
                    <option value={4800}>4800 baud</option>
                    <option value={2400}>2400 baud</option>
                    <option value={19200}>19200 baud</option>
                    <option value={115200}>115200 baud</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data Framing & Parity</label>
                  <input
                    type="text"
                    disabled
                    value="8 Data bits, 1 Stop bit, None (8N1)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Modbus Slave Unit ID</label>
                  <input
                    type="number"
                    min={1}
                    max={247}
                    value={serialConfig.slaveId}
                    onChange={(e) =>
                      updateSerialConfig({ slaveId: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Hardware Wiring Pinout Guide */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                <div className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  SRNE RJ45 Communication Pinout (RS485)
                </div>
                <div className="text-[11px] font-mono text-slate-400 space-y-1">
                  <div>· Pin 1 & Pin 2: RS485-A (Data +)</div>
                  <div>· Pin 7 & Pin 8: RS485-B (Data -)</div>
                  <div>· Pin 5: Ground (GND)</div>
                  <div className="text-amber-400/90 pt-1">
                    Connect Pin 1/2 to your USB adapter A(+) and Pin 7/8 to B(-).
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'python' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Install dependency: <code className="text-amber-300">pip install minimalmodbus pyserial</code>
                </span>
                <button
                  onClick={() => handleCopy(pythonScript, 'python')}
                  className="px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  {copiedType === 'python' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedType === 'python' ? 'Copied!' : 'Copy Script'}
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed">
                {pythonScript}
              </pre>
            </div>
          )}

          {activeTab === 'systemd' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Path: <code className="text-amber-300">/etc/systemd/system/srne-monitor.service</code>
                </span>
                <button
                  onClick={() => handleCopy(systemdScript, 'systemd')}
                  className="px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  {copiedType === 'systemd' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedType === 'systemd' ? 'Copied!' : 'Copy Service Unit'}
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed">
                {systemdScript}
              </pre>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono">
                $ sudo systemctl daemon-reload && sudo systemctl enable --now srne-monitor
              </div>
            </div>
          )}

          {activeTab === 'homeassistant' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Add to <code className="text-amber-300">configuration.yaml</code>
                </span>
                <button
                  onClick={() => handleCopy(haYaml, 'ha')}
                  className="px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  {copiedType === 'ha' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedType === 'ha' ? 'Copied!' : 'Copy YAML'}
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed">
                {haYaml}
              </pre>
            </div>
          )}

          {activeTab === 'esp' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-100">
                  <Wifi className="w-4 h-4 text-amber-400" />
                  ESP32 / ESP8266 Wireless Modbus Bridge
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Eliminates physical USB cables between your Linux PC and the solar inverter.
                  The ESP connects to the SRNE RJ45 port via RS485, logs offline data to LittleFS flash during network disconnects,
                  and automatically syncs all backlogged records when reconnected!
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">
                    Status:{' '}
                    <strong className={espStatus.connected ? 'text-emerald-400' : 'text-slate-400'}>
                      {espStatus.connected ? 'ESP32 Connected' : 'Offline / Standby'}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <div className="font-semibold text-slate-200 mb-1">Full Firmware Generator & Live Monitor</div>
                <p className="text-slate-400 mb-3">
                  Use the dedicated <strong>ESP32 WiFi Bridge</strong> tab on the top menu to customize your WiFi SSID,
                  configure LittleFS partition, download ready-to-flash .ino code, and test offline sync replay.
                </p>
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg transition-colors"
                >
                  Go to ESP32 Firmware & Bridge Tab
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
