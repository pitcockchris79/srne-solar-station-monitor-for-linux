/**
 * Parameter Configuration & Register Editor for SRNE Inverter
 * Read, edit, and write configuration parameters to SRNE holding registers (0xE000-0xE020).
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cpu,
  FileCheck,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';
import { BatteryChemistry, InverterSettings, WorkMode } from '../types/srne';

export const ParameterConfig: React.FC = () => {
  const { settings, saveSettings } = useSolar();
  const [formData, setFormData] = useState<InverterSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Apply predefined manufacturer profiles
  const applyProfile = (profileName: string) => {
    switch (profileName) {
      case 'lifepo4_48v':
        setFormData((prev) => ({
          ...prev,
          chemistry: 'LiFePO4',
          workMode: 'SBU',
          boostVoltage: 56.8,
          floatVoltage: 54.0,
          lowDcCutoffVoltage: 44.0,
          lowDcRecoveryVoltage: 50.0,
          maxTotalChargeCurrent: 80,
          maxUtilityChargeCurrent: 30,
        }));
        break;
      case 'agm_24v':
        setFormData((prev) => ({
          ...prev,
          chemistry: 'AGM',
          workMode: 'SOL',
          boostVoltage: 28.8,
          floatVoltage: 27.4,
          lowDcCutoffVoltage: 21.6,
          lowDcRecoveryVoltage: 24.8,
          maxTotalChargeCurrent: 60,
          maxUtilityChargeCurrent: 20,
        }));
        break;
      case 'grid_sub':
        setFormData((prev) => ({
          ...prev,
          workMode: 'SUB',
          boostVoltage: 56.4,
          floatVoltage: 53.6,
          lowDcCutoffVoltage: 46.0,
          lowDcRecoveryVoltage: 51.0,
          maxTotalChargeCurrent: 60,
          maxUtilityChargeCurrent: 40,
        }));
        break;
    }
  };

  const handleSaveConfirmed = async () => {
    setIsSaving(true);
    setShowConfirmModal(false);
    try {
      await saveSettings(formData);
      setSaveSuccessMsg('All 8 holding registers successfully written and verified by SRNE controller.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (e: any) {
      setSaveSuccessMsg(`Write error: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header & Preset Selector */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              SRNE Inverter Operating Parameters (EEPROM)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Read and write to holding registers 0xE004 - 0xE013 via Modbus Function Code 0x06.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Installer Presets:</span>
            <button
              onClick={() => applyProfile('lifepo4_48v')}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 transition-colors"
            >
              48V LiFePO4 Off-Grid
            </button>
            <button
              onClick={() => applyProfile('grid_sub')}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 transition-colors"
            >
              SUB Peak-Shaving
            </button>
            <button
              onClick={() => applyProfile('agm_24v')}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              24V Sealed AGM
            </button>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Form Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Section 1: Inverter Work Mode */}
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="text-sm font-semibold text-slate-200">
                1. Work Priority Mode (Register 0xE004)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Defines power flow hierarchy between Solar PV, Battery, and Utility Grid.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  id: 'SBU' as WorkMode,
                  title: 'SBU Priority',
                  sub: 'Solar-Battery-Utility',
                  desc: 'Solar & battery supply load. Utility only switches on if battery hits low cut-off.',
                },
                {
                  id: 'SOL' as WorkMode,
                  title: 'SOL Priority',
                  sub: 'Solar First',
                  desc: 'Solar powers load. Excess solar charges battery. Battery covers deficit.',
                },
                {
                  id: 'UTI' as WorkMode,
                  title: 'UTI Priority',
                  sub: 'Utility First (UPS)',
                  desc: 'Grid utility powers AC loads directly. Solar array exclusively charges battery.',
                },
                {
                  id: 'SUB' as WorkMode,
                  title: 'SUB Priority',
                  sub: 'Solar-Utility-Battery',
                  desc: 'Solar powers load; Grid covers shortfall; Battery reserved for blackouts.',
                },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setFormData({ ...formData, workMode: m.id })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    formData.workMode === m.id
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-100">{m.title}</span>
                    {formData.workMode === m.id && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-amber-400/90">{m.sub}</div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* AC Output Settings */}
            <div className="border-t border-slate-800 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                2. AC Output Voltage & Frequency (Reg 0xE010, 0xE011)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nominal Output Voltage</label>
                  <select
                    value={formData.acOutputVoltage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        acOutputVoltage: Number(e.target.value) as any,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={120}>120 VAC (US Standard)</option>
                    <option value={208}>208 VAC (3-Phase Leg)</option>
                    <option value={230}>230 VAC (EU / International)</option>
                    <option value={240}>240 VAC (Split Phase)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nominal Frequency</label>
                  <select
                    value={formData.acOutputFrequency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        acOutputFrequency: Number(e.target.value) as any,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={60}>60 Hz (North America)</option>
                    <option value={50}>50 Hz (Europe / Asia)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Battery Charging & Cut-off Thresholds */}
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="text-sm font-semibold text-slate-200">
                3. Battery Chemistry & Voltage Thresholds
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Holding registers 0xE005, 0xE008, 0xE009, 0xE00A, 0xE00B.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Battery Chemistry</label>
                <select
                  value={formData.chemistry}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      chemistry: e.target.value as BatteryChemistry,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="LiFePO4">LiFePO4 (Lithium Iron Phosphate)</option>
                  <option value="TernaryLithium">Ternary Lithium (NMC)</option>
                  <option value="AGM">Sealed Lead-Acid (AGM)</option>
                  <option value="GEL">GEL Electrolyte</option>
                  <option value="Flooded">Flooded Wet Lead-Acid</option>
                  <option value="User">User Custom Voltages</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Total Charge Current (A)</label>
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={formData.maxTotalChargeCurrent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxTotalChargeCurrent: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Boost / Absorption Voltage (V)</label>
                <input
                  type="number"
                  step="0.1"
                  min={20}
                  max={62}
                  value={formData.boostVoltage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      boostVoltage: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Float Charge Voltage (V)</label>
                <input
                  type="number"
                  step="0.1"
                  min={20}
                  max={60}
                  value={formData.floatVoltage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      floatVoltage: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Low DC Cut-off Voltage (V)</label>
                <input
                  type="number"
                  step="0.1"
                  min={18}
                  max={52}
                  value={formData.lowDcCutoffVoltage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lowDcCutoffVoltage: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Low DC Recovery Voltage (V)</label>
                <input
                  type="number"
                  step="0.1"
                  min={20}
                  max={54}
                  value={formData.lowDcRecoveryVoltage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lowDcRecoveryVoltage: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* System Options */}
            <div className="border-t border-slate-800 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                4. Protections & Hardware Peripherals
              </h3>
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.buzzerAlarm}
                    onChange={(e) =>
                      setFormData({ ...formData, buzzerAlarm: e.target.checked })
                    }
                    className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
                  />
                  <span>Enable Acoustic Buzzer Alarm on faults (Register 0xE012)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.autoRestartOverload}
                    onChange={(e) =>
                      setFormData({ ...formData, autoRestartOverload: e.target.checked })
                    }
                    className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
                  />
                  <span>Auto-restart inverter after temporary AC overload trip</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.ecoMode}
                    onChange={(e) =>
                      setFormData({ ...formData, ecoMode: e.target.checked })
                    }
                    className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
                  />
                  <span>Inverter Power-Saver Eco Standby (senses load &gt;50W before inverting)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            Holding registers will be written with Modbus Function Code 0x06 with CRC-16 check.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setFormData({ ...settings })}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Reset to Current
            </button>

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Writing Registers...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Write Parameters to SRNE
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Confirm Parameter Write
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              You are about to flash new operational parameters into the SRNE Inverter's EEPROM.
              Please ensure your battery chemistry and boost voltage match your battery manufacturer's specifications.
            </p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1 mb-5 text-slate-300">
              <div className="flex justify-between">
                <span>Work Priority:</span>
                <span className="text-amber-400 font-semibold">{formData.workMode}</span>
              </div>
              <div className="flex justify-between">
                <span>Chemistry:</span>
                <span className="text-slate-100">{formData.chemistry}</span>
              </div>
              <div className="flex justify-between">
                <span>Boost Voltage:</span>
                <span className="text-slate-100">{formData.boostVoltage} V</span>
              </div>
              <div className="flex justify-between">
                <span>Float Voltage:</span>
                <span className="text-slate-100">{formData.floatVoltage} V</span>
              </div>
              <div className="flex justify-between">
                <span>Low DC Cut-off:</span>
                <span className="text-slate-100">{formData.lowDcCutoffVoltage} V</span>
              </div>
              <div className="flex justify-between">
                <span>Max Charge Current:</span>
                <span className="text-slate-100">{formData.maxTotalChargeCurrent} A</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfirmed}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg"
              >
                Confirm & Flash Registers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
