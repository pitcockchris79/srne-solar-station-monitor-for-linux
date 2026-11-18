/**
 * Top Bar adhering strictly to the Top Bar Contract (Section 2 of frontend-design)
 * Three zones: [Single text brand wordmark] — [4-5 concise nav links] — [1 primary action]
 */

import React from 'react';
import {
  Activity,
  AlertTriangle,
  Cable,
  Download,
  Moon,
  Radio,
  Sliders,
  Sun,
  Terminal,
  Wifi,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';

export type NavTab = 'flow' | 'telemetry' | 'analytics' | 'parameters' | 'modbus' | 'diagnostics' | 'esp_bridge';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onOpenLinuxTools: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenLinuxTools,
  darkMode,
  setDarkMode,
}) => {
  const { connectionMode, connectionStatus, telemetry } = useSolar();

  const faultCount = telemetry?.activeFaults.length || 0;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Radio className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
              SRNE Solar Station Monitor
            </span>
            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
              Linux Workstation Telemetry · RS485 Modbus RTU
            </span>
          </div>
        </div>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('flow')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'flow'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Station Flow
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'telemetry'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Telemetry & BMS
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Analytics & Logs
          </button>

          <button
            onClick={() => setActiveTab('parameters')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'parameters'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Inverter Config
          </button>

          <button
            onClick={() => setActiveTab('modbus')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'modbus'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Modbus Packets
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            } ${faultCount > 0 ? 'text-rose-400 font-semibold' : ''}`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${faultCount > 0 ? 'text-rose-400 animate-pulse' : ''}`} />
            Diagnostics {faultCount > 0 ? `(${faultCount})` : ''}
          </button>

          <button
            onClick={() => setActiveTab('esp_bridge')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'esp_bridge'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-amber-400" />
            ESP32 WiFi Bridge
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle color theme"
            className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenLinuxTools}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 shadow-sm"
          >
            <Cable className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono">
              {connectionMode === 'webserial'
                ? 'Port: /dev/ttyUSB'
                : connectionMode === 'esp32'
                ? 'ESP32 Wireless'
                : 'Linux Ports'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
