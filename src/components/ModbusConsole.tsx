/**
 * Live Modbus RTU Hex Packet Inspector & Custom Command Console
 */

import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Copy,
  Download,
  Filter,
  Play,
  RotateCcw,
  Send,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useSolar } from '../context/SolarContext';
import { calculateModbusCrc16 } from '../utils/modbus';

export const ModbusConsole: React.FC = () => {
  const { packets, clearPackets, sendCustomModbusFrame } = useSolar();
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'TX' | 'RX'>('ALL');
  const [isPaused, setIsPaused] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Command Builder state
  const [cmdSlaveId, setCmdSlaveId] = useState(1);
  const [cmdFunction, setCmdFunction] = useState<3 | 6>(3);
  const [cmdAddressHex, setCmdAddressHex] = useState('0x0100');
  const [cmdValue, setCmdValue] = useState(24);
  const [isSending, setIsSending] = useState(false);

  // Parse address
  const parsedAddress = cmdAddressHex.startsWith('0x')
    ? parseInt(cmdAddressHex, 16)
    : parseInt(cmdAddressHex, 10) || 0;

  // Filtered packets
  const filteredPackets = packets.filter((p) => {
    if (filterDirection === 'TX') return p.direction === 'TX';
    if (filterDirection === 'RX') return p.direction === 'RX';
    return true;
  });

  const handleCopyHex = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSendCommand = async () => {
    setIsSending(true);
    try {
      await sendCustomModbusFrame(cmdSlaveId, cmdFunction, parsedAddress, cmdValue);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Interactive Command Builder */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Modbus Frame Generator & Tester
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            CRC-16 Polynomial: 0xA001 (Little-Endian)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Slave Unit ID</label>
            <input
              type="number"
              min={1}
              max={247}
              value={cmdSlaveId}
              onChange={(e) => setCmdSlaveId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Function Code</label>
            <select
              value={cmdFunction}
              onChange={(e) => setCmdFunction(Number(e.target.value) as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value={3}>0x03 - Read Holding Registers</option>
              <option value={6}>0x06 - Write Single Register</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Start Address ({cmdAddressHex.startsWith('0x') ? 'Hex' : 'Dec'})
            </label>
            <input
              type="text"
              value={cmdAddressHex}
              onChange={(e) => setCmdAddressHex(e.target.value)}
              placeholder="e.g. 0x0100"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {cmdFunction === 3 ? 'Register Count (Qty)' : 'Write Value'}
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={cmdValue}
                onChange={(e) => setCmdValue(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200"
              />
              <button
                onClick={handleSendCommand}
                disabled={isSending}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Packet Stream Console */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg">
        {/* Controls & Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Filter Stream:</span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              {(['ALL', 'TX', 'RX'] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => setFilterDirection(dir)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    filterDirection === dir
                      ? 'bg-slate-800 text-amber-300 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
            <span className="text-xs font-mono text-slate-500">
              ({filteredPackets.length} frames logged)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                isPaused
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              {isPaused ? 'Stream Paused' : 'Pause'}
            </button>

            <button
              onClick={clearPackets}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Packet Table / Log */}
        <div className="mt-4 max-h-[460px] overflow-y-auto space-y-2 pr-1">
          {filteredPackets.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No Modbus packets matching filter. Polling cycle active.
            </div>
          ) : (
            filteredPackets.map((pkt) => (
              <div
                key={pkt.id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 font-mono text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 group transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Direction badge */}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 ${
                      pkt.direction === 'TX'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {pkt.direction === 'TX' ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownLeft className="w-3 h-3" />
                    )}
                    {pkt.direction}
                  </span>

                  <span className="text-slate-500 text-[11px]">{pkt.timestamp}</span>

                  <span className="text-slate-300 text-xs font-sans font-medium">
                    {pkt.summary}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-slate-400 text-[11px] tracking-wider select-all break-all">
                    {pkt.rawBytes}
                  </div>

                  <button
                    onClick={() => handleCopyHex(pkt.rawBytes, pkt.id)}
                    title="Copy hex bytes"
                    className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
                  >
                    {copiedId === pkt.id ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
