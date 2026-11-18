/**
 * Detailed Telemetry & BMS Instrument Gauges for SRNE Solar Station Monitor
 */

import React, { useState } from 'react';
import {
  Activity,
  BatteryCharging,
  Cpu,
  Gauge,
  Power,
  Sun,
  Thermometer,
  TowerControl,
  Zap,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';

export const TelemetryGauges: React.FC = () => {
  const { telemetry } = useSolar();
  const [dcLoadState, setDcLoadState] = useState(true);

  if (!telemetry) return null;

  // Cell voltage stats
  const cellVoltages = telemetry.cells.map((c) => c.voltage);
  const minCell = Math.min(...cellVoltages);
  const maxCell = Math.max(...cellVoltages);
  const deltaMv = Math.round((maxCell - minCell) * 1000);

  return (
    <div className="space-y-6">
      {/* 4-Column Primary Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Solar Array */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <Sun className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">Solar PV Array</h3>
              </div>
              <span className="text-[11px] font-mono text-amber-400 font-medium">
                {telemetry.pvStatus}
              </span>
            </div>

            <div className="my-3">
              <div className="text-3xl font-bold font-mono tracking-tight text-amber-400">
                {telemetry.pvPower}{' '}
                <span className="text-sm font-normal text-slate-400">W</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Peak Today:{' '}
                <span className="font-mono text-slate-200 font-medium">
                  {telemetry.pvPeakPowerToday} W
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Array Voltage:</span>
              <span className="text-slate-200">{telemetry.pvVoltage} V</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Array Current:</span>
              <span className="text-slate-200">{telemetry.pvCurrent} A</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Today Yield:</span>
              <span className="text-emerald-400 font-semibold">{telemetry.pvTodayYieldKwh} kWh</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Lifetime Yield:</span>
              <span className="text-slate-300">{telemetry.pvTotalYieldKwh} kWh</span>
            </div>
          </div>
        </div>

        {/* Card 2: LiFePO4 Battery */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <BatteryCharging className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">Battery Bank (BMS)</h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 font-medium">
                {telemetry.chargeStage}
              </span>
            </div>

            <div className="my-3 flex items-baseline justify-between">
              <div>
                <div className="text-3xl font-bold font-mono tracking-tight text-cyan-400">
                  {telemetry.soc}%
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Chemistry: <span className="text-slate-200 font-medium">{telemetry.chemistry}</span>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-sm font-mono font-bold ${
                    telemetry.batteryPower >= 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {telemetry.batteryPower >= 0 ? `+${telemetry.batteryPower}` : telemetry.batteryPower} W
                </span>
                <div className="text-[11px] font-mono text-slate-400">
                  {telemetry.remainingRunHours < 90 ? `~${telemetry.remainingRunHours}h left` : 'Fully charged'}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Pack Voltage:</span>
              <span className="text-slate-200">{telemetry.batteryVoltage} V</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Net Current:</span>
              <span className={telemetry.batteryCurrent >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                {telemetry.batteryCurrent >= 0 ? `+${telemetry.batteryCurrent}` : telemetry.batteryCurrent} A
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Battery Temp:</span>
              <span className="text-slate-200">{telemetry.batteryTemp}°C</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Cycles / SOH:</span>
              <span className="text-slate-300">
                {telemetry.cycles} cyc · {telemetry.soh}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Inverter Output */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">AC Output Loads</h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-medium">
                {telemetry.inverterStatus}
              </span>
            </div>

            <div className="my-3">
              <div className="text-3xl font-bold font-mono tracking-tight text-sky-400">
                {telemetry.acOutputActivePower}{' '}
                <span className="text-sm font-normal text-slate-400">W</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Load Factor:{' '}
                <span className="font-mono text-slate-200 font-medium">
                  {telemetry.loadPercentage}% of 5000W
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Output Voltage:</span>
              <span className="text-slate-200">{telemetry.acOutputVoltage} V</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Output Frequency:</span>
              <span className="text-slate-200">{telemetry.acOutputFrequency} Hz</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Output Current:</span>
              <span className="text-slate-200">{telemetry.acOutputCurrent} A</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Apparent Power:</span>
              <span className="text-slate-300">{telemetry.acOutputApparentPower} VA</span>
            </div>
          </div>
        </div>

        {/* Card 4: Utility Grid / Thermal */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <TowerControl className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">AC Grid & Thermal</h3>
              </div>
              <span
                className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                  telemetry.gridConnected ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-500'
                }`}
              >
                {telemetry.gridConnected ? 'Active' : 'Offline'}
              </span>
            </div>

            <div className="my-3">
              <div className="text-3xl font-bold font-mono tracking-tight text-indigo-300">
                {telemetry.gridPower}{' '}
                <span className="text-sm font-normal text-slate-400">W</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Heatsink Temp:{' '}
                <span className="font-mono text-slate-200 font-medium">
                  {telemetry.heatsinkTemp}°C
                </span>{' '}
                · Fan: <span className="font-mono text-slate-200">{telemetry.fanSpeed}%</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Grid Voltage:</span>
              <span className="text-slate-200">{telemetry.gridVoltage} V</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Grid Frequency:</span>
              <span className="text-slate-200">{telemetry.gridFrequency} Hz</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Transformer Temp:</span>
              <span className="text-slate-200">{telemetry.transformerTemp}°C</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Operating Mode:</span>
              <span className="text-amber-400 font-semibold">{telemetry.workMode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* LiFePO4 16-Cell BMS Detailed Voltage Matrix */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              LiFePO4 BMS 16S Cell Voltage Telemetry
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span>
              Min: <strong className="text-slate-200">{minCell.toFixed(3)}V</strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              Max: <strong className="text-slate-200">{maxCell.toFixed(3)}V</strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              Delta:{' '}
              <strong className={deltaMv > 50 ? 'text-amber-400' : 'text-emerald-400'}>
                {deltaMv} mV
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-400">
              Status: <span className="text-emerald-400">Nominal Balance</span>
            </span>
          </div>
        </div>

        {/* 16 Cells Bar Chart Grid */}
        <div className="grid grid-cols-8 sm:grid-cols-16 gap-2 pt-2">
          {telemetry.cells.map((cell) => {
            // Visual height based on voltage relative to 3.2V - 3.45V
            const pct = Math.max(15, Math.min(100, ((cell.voltage - 3.1) / (3.5 - 3.1)) * 100));
            const isHighest = cell.voltage === maxCell;
            const isLowest = cell.voltage === minCell;

            return (
              <div
                key={cell.id}
                className="flex flex-col items-center p-2 rounded-lg bg-slate-950 border border-slate-800/80 group hover:border-cyan-500/50 transition-colors"
              >
                <div className="text-[10px] font-mono text-slate-400 mb-1">
                  C{cell.id < 10 ? `0${cell.id}` : cell.id}
                </div>

                {/* Vertical Gauge Bar */}
                <div className="w-full h-20 bg-slate-900 rounded-sm overflow-hidden flex flex-col justify-end p-0.5 relative">
                  <div
                    className={`w-full rounded-xs transition-all duration-300 ${
                      cell.balancing
                        ? 'bg-amber-400'
                        : isHighest
                        ? 'bg-emerald-400'
                        : isLowest
                        ? 'bg-sky-400'
                        : 'bg-cyan-500'
                    }`}
                    style={{ height: `${pct}%` }}
                  />
                  {cell.balancing && (
                    <div
                      title="Passive Balancing Active"
                      className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400"
                    />
                  )}
                </div>

                <div className="text-[11px] font-mono font-semibold text-slate-200 mt-1.5">
                  {cell.voltage.toFixed(3)}
                </div>
                <div className="text-[9px] font-mono text-slate-400">V</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auxiliary DC Load Switch (Standard on SRNE charge controllers) */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Power className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Auxiliary DC Load Output Terminal
            </div>
            <div className="text-xs text-slate-400">
              Direct DC 12V/24V/48V terminal control for lighting, sensors, or exhaust fan relays.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-xs font-mono text-slate-400">
            Voltage: <span className="text-slate-200">{telemetry.batteryVoltage} V</span> · Current:{' '}
            <span className="text-slate-200">{dcLoadState ? '1.8 A' : '0.0 A'}</span> · Power:{' '}
            <span className="text-amber-400 font-semibold">{dcLoadState ? `${Math.round(telemetry.batteryVoltage * 1.8)} W` : '0 W'}</span>
          </div>

          <button
            onClick={() => setDcLoadState(!dcLoadState)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
              dcLoadState
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {dcLoadState ? 'DC Load: ON' : 'DC Load: OFF'}
          </button>
        </div>
      </div>
    </div>
  );
};
