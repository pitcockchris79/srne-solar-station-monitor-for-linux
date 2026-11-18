/**
 * SRNE Diagnostics, Fault Dictionary & Alarm Monitor
 */

import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle,
  HelpCircle,
  Info,
  Search,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';
import { SRNE_FAULT_DICTIONARY } from '../utils/modbus';

export const DiagnosticsMatrix: React.FC = () => {
  const { telemetry, isBuzzerMuted, toggleBuzzerMute } = useSolar();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'FAULT' | 'WARNING'>('ALL');
  const [testFanActive, setTestFanActive] = useState(false);

  const activeFaults = telemetry?.activeFaults || [];

  // Filter dictionary items
  const dictionaryEntries = Object.entries(SRNE_FAULT_DICTIONARY).filter(([code, item]) => {
    const matchesSearch =
      code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.solution.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLevel =
      levelFilter === 'ALL' ||
      (levelFilter === 'FAULT' && item.level === 'fault') ||
      (levelFilter === 'WARNING' && (item.level === 'warning' || item.level === 'info'));

    return matchesSearch && matchesLevel;
  });

  const handleTestFan = () => {
    setTestFanActive(true);
    setTimeout(() => setTestFanActive(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Active Faults & Audio Buzzer Alert Banner */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                activeFaults.length > 0
                  ? 'bg-rose-500/10 text-rose-400'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {activeFaults.length > 0 ? (
                <AlertOctagon className="w-5 h-5 animate-bounce" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                {activeFaults.length > 0
                  ? `Active Diagnostic Alarms (${activeFaults.length})`
                  : 'System Status: All Diagnostics Nominal'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time inverter register 0x0116 & 0x0117 status code monitor.
              </p>
            </div>
          </div>

          {/* Buzzer Mute Toggle & Fan Test */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestFan}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                testFanActive
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              {testFanActive ? 'Fan Test Running (100% PWM)...' : 'Test Cooling Fan'}
            </button>

            <button
              onClick={toggleBuzzerMute}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                isBuzzerMuted
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              }`}
            >
              {isBuzzerMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isBuzzerMuted ? 'Buzzer Muted' : 'Acoustic Alarm: ON'}
            </button>
          </div>
        </div>

        {/* List of currently active faults */}
        {activeFaults.length > 0 ? (
          <div className="mt-4 space-y-3">
            {activeFaults.map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                      Fault {f.code}
                    </span>
                    <span className="text-sm font-semibold text-slate-100">{f.title}</span>
                    <span className="text-slate-500 text-xs font-mono">· {f.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-300">{f.description}</p>
                  <p className="text-xs text-rose-300/90 font-mono mt-1">
                    Required Action: {f.solution}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Zero active electrical or thermal alarms detected in holding registers.</span>
            </div>
            <span className="font-mono text-slate-500">Fault Register: 0x0000</span>
          </div>
        )}
      </div>

      {/* Official SRNE Fault & Warning Code Dictionary */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              SRNE Official Hardware Error & Warning Dictionary
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive lookup matrix for HF, ML, MC, and HES series inverters.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search code or symptom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 w-56 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              {(['ALL', 'FAULT', 'WARNING'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    levelFilter === lvl
                      ? 'bg-slate-800 text-amber-300 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dictionary Entries List */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
          {dictionaryEntries.map(([code, item]) => (
            <div
              key={code}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                        item.level === 'fault'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {code}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-200">{item.title}</h4>
                  </div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                    {item.level}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  {item.description}
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80">
                <span className="text-[11px] font-mono text-emerald-400/90 font-medium block">
                  Installer Resolution:
                </span>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {item.solution}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
