import {useState} from 'react';
import {Cpu, Database, HardDrive, Trash2} from 'lucide-react';
import type {MemoryLayer, ModelSlot} from '../types/workforce';

interface ModelsMemoryViewProps {
  modelSlots: ModelSlot[];
  onToggleModelLoad: (id: string) => void;
  memoryLayers: MemoryLayer[];
  onPurgeMemoryLayer: (id: string) => void;
  baseRuntimeRamMb: number;
}

const ONNX_PROVIDERS = ['CPU (Default)', 'DirectML', 'CoreML', 'CUDA', 'OpenVINO'] as const;

export function ModelsMemoryView({
  modelSlots,
  onToggleModelLoad,
  memoryLayers,
  onPurgeMemoryLayer,
  baseRuntimeRamMb,
}: ModelsMemoryViewProps) {
  const [provider, setProvider] = useState<(typeof ONNX_PROVIDERS)[number]>('CPU (Default)');

  const modelsRamMb = modelSlots.reduce((acc, m) => acc + (m.loaded ? m.ramMb : 0), 0);
  const osReserveMb = 2100;
  const totalMb = baseRuntimeRamMb + modelsRamMb + osReserveMb;
  const overBudget = totalMb > 8192;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 8GB RAM Budget Allocator */}
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold text-slate-100">
              Model Router & 8GB RAM Hardware Budget
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              ONNX Runtime CPU-first inference with lazy model loading and automatic unloading policies to protect 8GB CPU-only machines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#090D16] p-1">
            {ONNX_PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  provider === p
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Partitioned Memory Meter */}
        <div className="mt-5 rounded-lg border border-slate-800 bg-[#090D16] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-200">
              Estimated System Footprint ({provider})
            </span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                overBudget ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {totalMb.toLocaleString()} MB / 8,192 MB ({overBudget ? 'Exceeds 8GB Cap' : 'Within 8GB Target'})
            </span>
          </div>

          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="bg-slate-500"
              style={{width: `${(osReserveMb / 8192) * 100}%`}}
              title="OS Overhead"
            />
            <div
              className="bg-sky-500"
              style={{width: `${(baseRuntimeRamMb / 8192) * 100}%`}}
              title="Desktop UI + Rust Core + Connectors"
            />
            <div
              className={overBudget ? 'bg-red-500' : 'bg-emerald-500'}
              style={{width: `${Math.min(100, (modelsRamMb / 8192) * 100)}%`}}
              title="Loaded Local Models"
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div className="text-slate-400">
              OS Overhead Reserve: <span className="font-mono text-slate-200 tabular-nums">{osReserveMb} MB</span>
            </div>
            <div className="text-slate-400">
              Tauri UI + Rust Core + Connectors: <span className="font-mono text-sky-300 tabular-nums">{baseRuntimeRamMb} MB</span>
            </div>
            <div className="text-slate-400">
              Loaded Local Models: <span className="font-mono text-emerald-300 tabular-nums">{modelsRamMb} MB</span>
            </div>
          </div>
        </div>
      </section>

      {/* Modality Slots */}
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-400" />
            <h2 className="font-display text-sm font-semibold text-slate-100">
              AI Modality Lifecycle (Lazy Load / Unload)
            </h2>
          </div>
          <span className="text-xs text-slate-400">Independent per modality</span>
        </div>

        <div className="divide-y divide-slate-800/70">
          {modelSlots.map((slot) => (
            <div
              key={slot.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-sky-400">{slot.modality}</span>
                  <span className="text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-semibold text-slate-100">{slot.name}</span>
                  <span className="text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-400">
                    {slot.runtime} ({slot.quantization})
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{slot.purpose}</p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="font-mono text-xs text-slate-300 tabular-nums">
                  {slot.ramMb === 0 ? '0 MB (Cloud)' : `${slot.ramMb} MB`}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleModelLoad(slot.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    slot.loaded
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      : 'border-slate-700 bg-[#090D16] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {slot.loaded ? 'Loaded (Unload)' : 'Unloaded (Load)'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6-Layer Memory Architecture */}
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-400" />
            <h2 className="font-display text-sm font-semibold text-slate-100">
              6-Layer Selective Memory Architecture
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Selective retrieval only · Never preloads full database into RAM
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memoryLayers.map((layer) => (
            <div
              key={layer.id}
              className="flex flex-col justify-between rounded-lg border border-slate-800 bg-[#090D16] p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-100">{layer.name}</span>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {layer.entriesCount} items · {layer.sizeMb.toFixed(1)} MB
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <HardDrive className="h-3 w-3 shrink-0" />
                  <span>{layer.storageBackend}</span>
                </div>
                <div className="mt-2.5 space-y-1">
                  {layer.sampleItems.length === 0 ? (
                    <p className="text-[11px] italic text-slate-500">Layer cleared</p>
                  ) : (
                    layer.sampleItems.map((item) => (
                      <div key={item} className="truncate text-[11px] text-slate-400">
                        · {item}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-[11px] text-slate-500 truncate max-w-[170px]">
                  {layer.retentionRule}
                </span>
                <button
                  type="button"
                  disabled={layer.entriesCount === 0}
                  onClick={() => onPurgeMemoryLayer(layer.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-red-400 disabled:opacity-30 transition-colors whitespace-nowrap"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Purge</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
