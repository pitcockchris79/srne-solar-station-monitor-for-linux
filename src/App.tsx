/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  BatteryCharging,
  Cable,
  CheckCircle,
  Cpu,
  Download,
  Gauge,
  LineChart,
  Radio,
  Sliders,
  Sun,
  Terminal,
  TowerControl,
  Zap,
} from 'lucide-react';
import { Header, NavTab } from './components/Header';
import { LinuxToolsModal } from './components/LinuxToolsModal';
import { ModbusConsole } from './components/ModbusConsole';
import { ParameterConfig } from './components/ParameterConfig';
import { PowerFlowDiagram } from './components/PowerFlowDiagram';
import { SimulatorBar } from './components/SimulatorBar';
import { TelemetryGauges } from './components/TelemetryGauges';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { DiagnosticsMatrix } from './components/DiagnosticsMatrix';
import { EspBridgePanel } from './components/EspBridgePanel';
import { SolarProvider, useSolar } from './context/SolarContext';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('flow');
  const [isLinuxModalOpen, setIsLinuxModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const { telemetry, connectionMode, connectionStatus } = useSolar();

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar adhering to Top Bar Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLinuxTools={() => setIsLinuxModalOpen(true)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Interactive Hardware Scenario Workbench (in simulator mode) */}
      <SimulatorBar />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Solar PV Power</div>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">
                {telemetry?.pvPower || 0} <span className="text-xs font-normal">W</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Today: {telemetry?.pvTodayYieldKwh || 0} kWh
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sun className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Battery SOC & Flow</div>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">
                {telemetry?.soc || 0}%
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {telemetry?.batteryVoltage || 0}V ·{' '}
                <span className={(telemetry?.batteryPower || 0) >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {(telemetry?.batteryPower || 0) >= 0 ? `+${telemetry?.batteryPower}W` : `${telemetry?.batteryPower}W`}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <BatteryCharging className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Inverter AC Output</div>
              <div className="text-2xl font-bold font-mono text-sky-400 mt-0.5">
                {telemetry?.acOutputActivePower || 0} <span className="text-xs font-normal">W</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Load: {telemetry?.loadPercentage || 0}% of 5kW
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Cpu className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">AC Grid Status</div>
              <div className="text-2xl font-bold font-mono text-indigo-300 mt-0.5">
                {telemetry?.gridPower || 0} <span className="text-xs font-normal">W</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {telemetry?.gridConnected ? 'Grid 120V / 60Hz' : 'Off-Grid Islanded'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <TowerControl className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab View Switching */}
        {activeTab === 'flow' && (
          <div className="space-y-6">
            <PowerFlowDiagram onSelectNode={(node) => setActiveTab('telemetry')} />
            <TelemetryGauges />
          </div>
        )}

        {activeTab === 'telemetry' && <TelemetryGauges />}

        {activeTab === 'analytics' && <AnalyticsCharts />}

        {activeTab === 'parameters' && <ParameterConfig />}

        {activeTab === 'modbus' && <ModbusConsole />}

        {activeTab === 'diagnostics' && <DiagnosticsMatrix />}

        {activeTab === 'esp_bridge' && <EspBridgePanel />}
      </main>

      {/* Linux Connection & Daemon Modal */}
      <LinuxToolsModal
        isOpen={isLinuxModalOpen}
        onClose={() => setIsLinuxModalOpen(false)}
      />

      {/* Quiet Industrial Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-5 px-6 bg-slate-950 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span>SRNE Solar Station Monitor for Linux</span>
            <span aria-hidden="true">·</span>
            <span>Modbus RTU 9600-8N1</span>
            <span aria-hidden="true">·</span>
            <span>Compatible with Ubuntu, Debian, Raspberry Pi & Home Assistant</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] text-slate-400">
            <span>Interface: {connectionMode}</span>
            <span aria-hidden="true">·</span>
            <span>Status: {connectionStatus}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <SolarProvider>
      <MainLayout />
    </SolarProvider>
  );
}
