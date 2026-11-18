/**
 * Interactive Hardware & Environmental Workbench Simulator Bar
 * Allows rapid testing of solar scenarios, cloud cover, battery SOC, and grid outages.
 */

import React, { useState } from 'react';
import {
  CloudSun,
  Flame,
  Power,
  RotateCcw,
  Sliders,
  Sun,
  TowerControl,
  Zap,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';

export const SimulatorBar: React.FC = () => {
  const {
    connectionMode,
    activeScenario,
    applyScenarioPreset,
    setSimIrradiance,
    setSimLoadWatts,
    toggleSimGrid,
    telemetry,
  } = useSolar();

  const [irradiance, setLocalIrradiance] = useState(850);
  const [loadWatts, setLocalLoadWatts] = useState(1250);
  const [isExpanded, setIsExpanded] = useState(true);

  if (connectionMode !== 'simulator') return null;

  const handleIrradianceChange = (val: number) => {
    setLocalIrradiance(val);
    setSimIrradiance(val);
  };

  const handleLoadChange = (val: number) => {
    setLocalLoadWatts(val);
    setSimLoadWatts(val);
  };

  const scenarios = [
    { id: 'Sunny Midday', label: 'Sunny Midday (3.4kW)', icon: Sun },
    { id: 'Passing Clouds', label: 'Passing Clouds', icon: CloudSun },
    { id: 'High AC Load Spike', label: '4.6kW AC Spike', icon: Flame },
    { id: 'Grid Blackout (UPS)', label: 'Grid Outage / UPS', icon: TowerControl },
    { id: 'Low Battery Alert', label: 'Low Battery (18%)', icon: Zap },
    { id: 'LiFePO4 Top-Balance', label: 'LiFePO4 Float', icon: Sliders },
  ];

  return (
    <div className="bg-slate-900/95 border-b border-slate-800 px-6 py-3 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Scenario quick selectors */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-slate-300 whitespace-nowrap shrink-0 flex items-center gap-1.5 mr-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Hardware Test Scenarios:
          </span>

          {scenarios.map((sc) => {
            const Icon = sc.icon;
            const isActive = activeScenario === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => applyScenarioPreset(sc.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <Icon className="w-3 h-3" />
                {sc.label}
              </button>
            );
          })}
        </div>

        {/* Real-time Interactive Sliders */}
        <div className="flex items-center gap-6 text-xs shrink-0">
          {/* Solar Irradiance Slider */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">Sun:</span>
            <input
              type="range"
              min={0}
              max={1000}
              step={20}
              value={irradiance}
              onChange={(e) => handleIrradianceChange(Number(e.target.value))}
              className="w-20 sm:w-24 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-amber-400 w-12 text-right">
              {irradiance}W
            </span>
          </div>

          {/* AC Load Slider */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">Load:</span>
            <input
              type="range"
              min={100}
              max={5500}
              step={50}
              value={loadWatts}
              onChange={(e) => handleLoadChange(Number(e.target.value))}
              className="w-20 sm:w-24 accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-sky-400 w-14 text-right">
              {loadWatts}W
            </span>
          </div>

          {/* Grid Toggle Button */}
          <button
            onClick={toggleSimGrid}
            className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors flex items-center gap-1.5 ${
              telemetry?.gridConnected
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <TowerControl className="w-3 h-3" />
            Grid: {telemetry?.gridConnected ? '120V' : 'CUT'}
          </button>
        </div>
      </div>
    </div>
  );
};
