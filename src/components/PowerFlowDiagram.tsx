/**
 * Iconic SRNE Power Flow Diagram
 * Interactive SVG schematic with animated energy paths between PV, Inverter, Battery, Grid, and AC Loads.
 */

import React from 'react';
import {
  BatteryCharging,
  Cpu,
  Flame,
  Home,
  Sun,
  TowerControl,
  Zap,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';

interface PowerFlowProps {
  onSelectNode?: (nodeKey: string) => void;
}

export const PowerFlowDiagram: React.FC<PowerFlowProps> = ({ onSelectNode }) => {
  const { telemetry, settings } = useSolar();

  if (!telemetry) return null;

  const isCharging = telemetry.batteryPower > 10;
  const isDischarging = telemetry.batteryPower < -10;
  const isSolarActive = telemetry.pvPower > 10;
  const isGridActive = telemetry.gridConnected && (telemetry.gridPower > 10 || telemetry.inverterStatus === 'Bypass');
  const isLoadActive = telemetry.acOutputActivePower > 20;

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-6 shadow-xl relative overflow-hidden">
      {/* Top Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-medium text-slate-200">
            <span className="text-slate-400">Mode:</span>
            <span className="font-mono text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
              {telemetry.workMode}
            </span>
            <span className="text-slate-400">
              {telemetry.workMode === 'SBU' && '(Solar-Battery-Utility)'}
              {telemetry.workMode === 'SOL' && '(Solar First)'}
              {telemetry.workMode === 'UTI' && '(Utility First)'}
              {telemetry.workMode === 'SUB' && '(Solar-Utility-Battery)'}
            </span>
          </div>

          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>Status: <strong className="text-slate-200">{telemetry.inverterStatus}</strong></span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>Efficiency: <strong className="font-mono text-slate-200">{telemetry.efficiency}%</strong></span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>Heatsink: <strong className="font-mono text-slate-200">{telemetry.heatsinkTemp}°C</strong></span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">Daily Yield:</span>
          <span className="font-mono text-emerald-400 font-semibold">{telemetry.pvTodayYieldKwh} kWh</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">Daily Load:</span>
          <span className="font-mono text-sky-400 font-semibold">{telemetry.acTodayConsumptionKwh} kWh</span>
        </div>
      </div>

      {/* Interactive Power Diagram Area */}
      <div className="relative my-6 min-h-[420px] flex items-center justify-center">
        {/* Animated Background SVG Connection Lines */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 900 420"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="solarLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            <linearGradient id="batteryLine" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="gridLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="loadLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>

          {/* Conduit 1: Solar (top left) -> Inverter (center) */}
          <path
            d="M 220 110 L 450 210"
            stroke="#334155"
            strokeWidth="3"
            fill="none"
          />
          {isSolarActive && (
            <path
              d="M 220 110 L 450 210"
              stroke="#F59E0B"
              strokeWidth="3"
              strokeDasharray="6 6"
              className="animate-[dash_1.5s_linear_infinite]"
              fill="none"
            />
          )}

          {/* Conduit 2: Grid (bottom left) -> Inverter (center) */}
          <path
            d="M 220 310 L 450 210"
            stroke="#334155"
            strokeWidth="3"
            fill="none"
          />
          {isGridActive && (
            <path
              d="M 220 310 L 450 210"
              stroke="#6366F1"
              strokeWidth="3"
              strokeDasharray="6 6"
              className="animate-[dash_1.8s_linear_infinite]"
              fill="none"
            />
          )}

          {/* Conduit 3: Battery (bottom center) <-> Inverter (center) */}
          <path
            d="M 450 310 L 450 210"
            stroke="#334155"
            strokeWidth="3"
            fill="none"
          />
          {isCharging && (
            <path
              d="M 450 210 L 450 310"
              stroke="#10B981"
              strokeWidth="3"
              strokeDasharray="6 6"
              className="animate-[dash_1.5s_linear_infinite]"
              fill="none"
            />
          )}
          {isDischarging && (
            <path
              d="M 450 310 L 450 210"
              stroke="#06B6D4"
              strokeWidth="3"
              strokeDasharray="6 6"
              className="animate-[dash_1.5s_linear_infinite]"
              fill="none"
            />
          )}

          {/* Conduit 4: Inverter (center) -> AC Load (right center) */}
          <path
            d="M 450 210 L 680 210"
            stroke="#334155"
            strokeWidth="3"
            fill="none"
          />
          {isLoadActive && (
            <path
              d="M 450 210 L 680 210"
              stroke="#38BDF8"
              strokeWidth="3"
              strokeDasharray="6 6"
              className="animate-[dash_1.2s_linear_infinite]"
              fill="none"
            />
          )}
        </svg>

        {/* Nodes Layer (Grid of interactive hardware blocks) */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-y-12 gap-x-8 items-center relative z-10">
          {/* Column 1: Sources (Solar PV Top, Utility Grid Bottom) */}
          <div className="flex flex-col gap-10">
            {/* Node: Solar Array */}
            <div
              onClick={() => onSelectNode?.('pv')}
              className="cursor-pointer group bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-4 transition-all shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
                    <Sun className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">Solar PV Array</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isSolarActive ? 'text-amber-300 bg-amber-500/10' : 'text-slate-500'}`}>
                  {telemetry.pvStatus}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono tracking-tight text-amber-400">
                    {telemetry.pvPower}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1">W</span>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-400">
                  <div>{telemetry.pvVoltage} V</div>
                  <div>{telemetry.pvCurrent} A</div>
                </div>
              </div>
            </div>

            {/* Node: Utility Grid */}
            <div
              onClick={() => onSelectNode?.('grid')}
              className="cursor-pointer group bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition-all shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                    <TowerControl className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">AC Grid Input</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${telemetry.gridConnected ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500'}`}>
                  {telemetry.gridConnected ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono tracking-tight text-indigo-300">
                    {telemetry.gridPower}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1">W</span>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-400">
                  <div>{telemetry.gridVoltage} V</div>
                  <div>{telemetry.gridFrequency} Hz</div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Center Unit (Inverter Core Top, LiFePO4 Battery Bottom) */}
          <div className="flex flex-col gap-10">
            {/* Center Node: SRNE Inverter Core */}
            <div
              onClick={() => onSelectNode?.('inverter')}
              className="cursor-pointer group bg-slate-950 border-2 border-slate-700 hover:border-amber-500/60 rounded-xl p-5 shadow-2xl transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">SRNE Hybrid Inverter</div>
                    <div className="text-[10px] font-mono text-slate-400">Modbus ID: 0x01</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                    {telemetry.inverterStatus}
                  </span>
                </div>
              </div>

              {/* Inverter Load Metric */}
              <div className="my-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
                  <span>Inverter Load Factor</span>
                  <span className="font-mono text-slate-200 font-semibold">{telemetry.loadPercentage}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      telemetry.loadPercentage > 85
                        ? 'bg-rose-500'
                        : telemetry.loadPercentage > 60
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, telemetry.loadPercentage)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1">
                <div>Fan: <strong className="text-slate-200">{telemetry.fanSpeed}%</strong></div>
                <div>Temp: <strong className="text-slate-200">{telemetry.heatsinkTemp}°C</strong></div>
              </div>
            </div>

            {/* Bottom Center Node: LiFePO4 Battery Bank */}
            <div
              onClick={() => onSelectNode?.('battery')}
              className="cursor-pointer group bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-all shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition-transform">
                    <BatteryCharging className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-200">LiFePO4 Bank (48V)</span>
                    <span className="text-[10px] font-mono text-slate-400 ml-1.5">{telemetry.chargeStage}</span>
                  </div>
                </div>
                <span className="text-base font-bold font-mono text-cyan-400">
                  {telemetry.soc}%
                </span>
              </div>

              {/* Battery SOC Visual Bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-cyan-400 transition-all duration-500"
                  style={{ width: `${telemetry.soc}%` }}
                />
              </div>

              <div className="flex items-baseline justify-between text-[11px] font-mono text-slate-400">
                <div>
                  <span className={`font-semibold ${isCharging ? 'text-emerald-400' : isDischarging ? 'text-amber-400' : 'text-slate-300'}`}>
                    {telemetry.batteryPower > 0 ? `+${telemetry.batteryPower}` : telemetry.batteryPower} W
                  </span>
                </div>
                <div className="text-right">
                  <span>{telemetry.batteryVoltage} V</span> · <span>{telemetry.batteryCurrent > 0 ? `+${telemetry.batteryCurrent}` : telemetry.batteryCurrent} A</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Destination (AC Load Output) */}
          <div className="flex flex-col gap-10">
            {/* Node: AC Home / Facility Load */}
            <div
              onClick={() => onSelectNode?.('load')}
              className="cursor-pointer group bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-xl p-4 transition-all shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:scale-105 transition-transform">
                    <Home className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">AC Output Loads</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {telemetry.acOutputFrequency} Hz
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono tracking-tight text-sky-400">
                    {telemetry.acOutputActivePower}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1">W</span>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-400">
                  <div>{telemetry.acOutputVoltage} V</div>
                  <div>{telemetry.acOutputCurrent} A</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80 pt-1.5">
                <span>Apparent: {telemetry.acOutputApparentPower} VA</span>
                <span>PF ~ 0.98</span>
              </div>
            </div>

            {/* Quick Helper / System Diagnostic Pill */}
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Power Balance</span>
              </div>
              <div className="text-[11px] space-y-0.5 font-mono text-slate-400">
                <div className="flex justify-between">
                  <span>Solar Generation:</span>
                  <span className="text-amber-400 font-semibold">{telemetry.pvPower} W</span>
                </div>
                <div className="flex justify-between">
                  <span>Battery Flow:</span>
                  <span className={telemetry.batteryPower >= 0 ? 'text-emerald-400' : 'text-cyan-400'}>
                    {telemetry.batteryPower >= 0 ? `+${telemetry.batteryPower} W (Charging)` : `${telemetry.batteryPower} W (Discharging)`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Grid Contribution:</span>
                  <span className="text-indigo-400">{telemetry.gridPower} W</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
