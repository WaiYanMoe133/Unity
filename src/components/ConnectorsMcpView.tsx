import {useState} from 'react';
import {Cpu, Globe, Lock, Plug} from 'lucide-react';
import type {ConnectorDef} from '../types/workforce';

interface ConnectorsMcpViewProps {
  connectors: ConnectorDef[];
  onToggleConnector: (id: string) => void;
}

const FILTERS: ('All' | ConnectorDef['type'])[] = [
  'All',
  'Native',
  'Office',
  'MCP 2026',
  'WASM Sandbox',
  'A2A 1.0',
];

export function ConnectorsMcpView({connectors, onToggleConnector}: ConnectorsMcpViewProps) {
  const [filter, setFilter] = useState<'All' | ConnectorDef['type']>('All');

  const filtered =
    filter === 'All' ? connectors : connectors.filter((c) => c.type === filter);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold text-slate-100">
              Connector SDK, MCP 2026, WASM & A2A Runtime
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Native connectors handle critical local work; MCP 2026 and A2A 1.0 operate strictly as interoperability layers; third-party plugins run inside Wasmtime sandboxes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#090D16] p-1 shrink-0">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === f
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((conn) => (
          <article
            key={conn.id}
            className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#131B2E] p-5"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">
                    {conn.type} · v{conn.version} · {conn.license}
                  </div>
                  <h2 className="mt-1 flex items-center gap-2 font-display text-sm font-semibold text-slate-100">
                    <Plug className="h-4 w-4 shrink-0 text-sky-400" />
                    <span className="truncate">{conn.name}</span>
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleConnector(conn.id)}
                  className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    conn.enabled
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      : 'border-slate-700 bg-[#090D16] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {conn.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <p className="mt-2.5 text-xs text-slate-400 leading-relaxed">{conn.description}</p>

              <dl className="mt-4 space-y-2 border-t border-slate-800/80 pt-3 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Actions</dt>
                  <dd className="font-mono text-slate-200 text-right">
                    {conn.supportedActions.join(', ')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Permissions</dt>
                  <dd className="font-mono text-amber-300/90 text-right">
                    {conn.requiredPermissions.join(', ')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Platforms</dt>
                  <dd className="text-slate-300 capitalize text-right">
                    {conn.platforms.join(' · ')}
                  </dd>
                </div>
              </dl>
            </div>

            {conn.sandboxLimits && (
              <div className="mt-4 rounded-lg border border-slate-800 bg-[#090D16] px-3.5 py-2.5 text-[11px] text-slate-400">
                <div className="flex items-center justify-between font-medium text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Wasmtime Sandbox Guard</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {conn.sandboxLimits.memoryMb} MB cap
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    Fuel: {conn.sandboxLimits.fuelLimit}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Network: {conn.sandboxLimits.networkRestricted ? 'Blocked by Host Bridge' : 'Scoped'}
                  </span>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
