/**
 * Real-Time Analytics & Historical Trends for SRNE Solar Station Monitor
 * Responsive SVG charts for PV power, AC load, battery SOC, and temperatures.
 */

import React, { useState } from 'react';
import {
  Calendar,
  Download,
  Flame,
  LineChart,
  RefreshCw,
  Sun,
  Zap,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';
import { HistoryPoint } from '../types/srne';

type TimeRange = 'live' | 'today' | '7d' | '30d';

export const AnalyticsCharts: React.FC = () => {
  const { history, exportCsvData, telemetry } = useSolar();
  const [timeRange, setTimeRange] = useState<TimeRange>('live');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Fallback points if empty
  const points: HistoryPoint[] = history.length > 0 ? history : [];

  // Compute scale boundaries
  const maxPv = Math.max(...points.map((p) => p.pvPower), 3500);
  const maxLoad = Math.max(...points.map((p) => p.loadPower), 2000);
  const maxPower = Math.max(maxPv, maxLoad, 1000);

  const chartWidth = 860;
  const chartHeight = 260;
  const padding = { top: 20, right: 30, bottom: 30, left: 50 };

  const usableWidth = chartWidth - padding.left - padding.right;
  const usableHeight = chartHeight - padding.top - padding.bottom;

  // Coordinate mapper
  const getX = (idx: number) => {
    if (points.length <= 1) return padding.left;
    return padding.left + (idx / (points.length - 1)) * usableWidth;
  };

  const getYPower = (val: number) => {
    return padding.top + usableHeight - (Math.max(0, val) / maxPower) * usableHeight;
  };

  const getYSoc = (val: number) => {
    return padding.top + usableHeight - (Math.max(0, Math.min(100, val)) / 100) * usableHeight;
  };

  // Build SVG path strings
  const pvPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getYPower(p.pvPower).toFixed(1)}`)
    .join(' ');

  const loadPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getYPower(p.loadPower).toFixed(1)}`)
    .join(' ');

  const socPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getYSoc(p.batterySoc).toFixed(1)}`)
    .join(' ');

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : points[points.length - 1];

  return (
    <div className="space-y-6">
      {/* Top Controls & Energy Summary */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <LineChart className="w-4 h-4 text-amber-400" />
              Solar Generation & Load Trends
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous Modbus telemetry stream recording at 1Hz sampling interval.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Range segmented buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
              {(['live', 'today', '7d', '30d'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    timeRange === range
                      ? 'bg-slate-800 text-amber-300 shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {range === 'live' && 'Live (Rolling)'}
                  {range === 'today' && 'Today (24h)'}
                  {range === '7d' && '7 Days'}
                  {range === '30d' && '30 Days'}
                </button>
              ))}
            </div>

            {/* CSV Export */}
            <button
              onClick={exportCsvData}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Energy Balance Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-800/80 text-xs">
          <div>
            <div className="text-slate-400">Total Solar Yield</div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
              {telemetry?.pvTodayYieldKwh || 0} <span className="text-xs font-normal">kWh</span>
            </div>
          </div>
          <div>
            <div className="text-slate-400">AC Load Consumed</div>
            <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">
              {telemetry?.acTodayConsumptionKwh || 0} <span className="text-xs font-normal">kWh</span>
            </div>
          </div>
          <div>
            <div className="text-slate-400">Battery State of Charge</div>
            <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
              {telemetry?.soc || 0}%
            </div>
          </div>
          <div>
            <div className="text-slate-400">Solar Self-Sufficiency</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {telemetry && telemetry.gridPower === 0 ? '100%' : '92.4%'}
            </div>
          </div>
        </div>

        {/* Live Power Traces Chart */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Solar PV (W)
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                Inverter Load (W)
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                Battery SOC (%)
              </span>
            </div>

            {activePoint && (
              <div className="font-mono text-xs text-slate-300 flex items-center gap-3">
                <span className="text-slate-400">{activePoint.time}</span>
                <span className="text-amber-400">PV: {activePoint.pvPower}W</span>
                <span className="text-sky-400">Load: {activePoint.loadPower}W</span>
                <span className="text-cyan-400">SOC: {activePoint.batterySoc}%</span>
              </div>
            )}
          </div>

          {/* SVG Canvas */}
          <div className="relative bg-slate-950 rounded-lg border border-slate-800 p-2 overflow-hidden">
            <svg
              className="w-full h-64 cursor-crosshair"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, (mouseX - padding.left) / usableWidth));
                const idx = Math.round(ratio * (points.length - 1));
                setHoverIndex(idx);
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {/* Horizontal Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = padding.top + usableHeight * (1 - pct);
                const val = Math.round(maxPower * pct);
                return (
                  <g key={pct}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      textAnchor="end"
                    >
                      {val}W
                    </text>
                  </g>
                );
              })}

              {/* Solar Line */}
              {pvPath && (
                <path
                  d={pvPath}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Load Line */}
              {loadPath && (
                <path
                  d={loadPath}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Battery SOC Line (scaled to right axis) */}
              {socPath && (
                <path
                  d={socPath}
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Hover vertical crosshair */}
              {hoverIndex !== null && (
                <line
                  x1={getX(hoverIndex)}
                  y1={padding.top}
                  x2={getX(hoverIndex)}
                  y2={chartHeight - padding.bottom}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* Secondary Graphs: Thermal Behavior & Daily Energy Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Graph 2: Thermal Profile */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              Thermal Dynamics & Fan Cooling
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Heatsink: <strong className="text-slate-200">{telemetry?.heatsinkTemp}°C</strong>
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Inverter IGBT Heatsink (Limit: 85°C)</span>
                <span className="font-mono text-slate-200">{telemetry?.heatsinkTemp}°C</span>
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    (telemetry?.heatsinkTemp || 0) > 75
                      ? 'bg-rose-500'
                      : (telemetry?.heatsinkTemp || 0) > 55
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, ((telemetry?.heatsinkTemp || 30) / 90) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Inverter Main Transformer Temp</span>
                <span className="font-mono text-slate-200">{telemetry?.transformerTemp}°C</span>
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, ((telemetry?.transformerTemp || 30) / 90) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Cooling Fan PWM Duty Cycle</span>
                <span className="font-mono text-slate-200">{telemetry?.fanSpeed}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${telemetry?.fanSpeed || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Graph 3: Energy Distribution Breakdown */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Daily Energy Flow Distribution
            </h3>
            <span className="text-xs font-mono text-emerald-400 font-medium">Nominal Net</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-slate-300">Direct Solar Yield (PV)</span>
              </div>
              <span className="font-mono text-slate-100 font-semibold">{telemetry?.pvTodayYieldKwh} kWh</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span className="text-slate-300">Total Inverter AC Consumption</span>
              </div>
              <span className="font-mono text-slate-100 font-semibold">{telemetry?.acTodayConsumptionKwh} kWh</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-slate-300">Battery Cycled Throughput</span>
              </div>
              <span className="font-mono text-slate-100 font-semibold">6.40 kWh</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                <span className="text-slate-300">Grid Import / Utility Backup</span>
              </div>
              <span className="font-mono text-slate-100 font-semibold">0.00 kWh</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
