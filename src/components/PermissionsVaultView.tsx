import {KeyRound, Power, ShieldAlert, ShieldCheck} from 'lucide-react';
import {RISK_POLICY_MATRIX} from '../data/presetsAndBlueprint';
import type {AuditEntry} from '../types/workforce';

interface PermissionsVaultViewProps {
  killSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  auditLog: AuditEntry[];
}

const VAULT_ENTRIES = [
  {
    name: 'Local Authenticated Office Bridge Token',
    scope: 'localhost:18492 IPC · Session Ephemeral',
    storage: 'OS Keychain / Rust Memory Zeroize',
  },
  {
    name: 'MCP Market Server OAuth Bearer',
    scope: 'Read-only market pricing endpoints',
    storage: 'Encrypted Secret Vault (AES-256-GCM)',
  },
  {
    name: 'Cloud AI Planner Key',
    scope: 'Server-side / Env Managed (Never in UI logs)',
    storage: 'Process Environment Secret',
  },
];

export function PermissionsVaultView({
  killSwitchActive,
  onToggleKillSwitch,
  auditLog,
}: PermissionsVaultViewProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Global Kill Switch */}
      <section
        className={`rounded-xl border p-5 ${
          killSwitchActive
            ? 'border-red-500/50 bg-red-500/10'
            : 'border-slate-800/90 bg-[#131B2E]'
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert
                className={`h-4 w-4 ${killSwitchActive ? 'text-red-400' : 'text-sky-400'}`}
              />
              <h1 className="font-display text-lg font-semibold text-slate-100">
                Execution Kill Switch & Policy Center
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              AI models cannot approve their own high-risk operations. Policy enforcement and emergency cancellation live strictly inside the Rust Execution Engine.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleKillSwitch}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              killSwitchActive
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25'
            }`}
          >
            <Power className="h-4 w-4" />
            <span>{killSwitchActive ? 'Restore Execution Engine' : 'Engage Emergency Kill Switch'}</span>
          </button>
        </div>
      </section>

      {/* Risk Tier Policy Matrix */}
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] overflow-hidden">
        <div className="border-b border-slate-800/80 px-5 py-3.5">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Risk-Based Least-Privilege Matrix
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800/80 bg-[#090D16] text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Risk Tier</th>
                <th className="px-4 py-2.5 font-medium">Operation Examples</th>
                <th className="px-4 py-2.5 font-medium">Approval Enforcement</th>
                <th className="px-4 py-2.5 font-medium">Audit & Recovery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {RISK_POLICY_MATRIX.map((row) => (
                <tr key={row.level}>
                  <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                    <span
                      className={
                        row.level === 'LOW'
                          ? 'text-emerald-400'
                          : row.level === 'MEDIUM'
                            ? 'text-amber-400'
                            : row.level === 'HIGH'
                              ? 'text-orange-400'
                              : 'text-red-400'
                      }
                    >
                      {row.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{row.examples}</td>
                  <td className="px-4 py-3 text-slate-300">{row.approvalRule}</td>
                  <td className="px-4 py-3 text-slate-400">{row.auditPolicy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Secret Vault */}
        <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5 lg:col-span-5">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-sky-400" />
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Credential Vault Metadata
            </h2>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Secrets remain sealed inside the Rust host vault and are never exposed to the frontend DOM, LLM context, or telemetry logs.
          </p>
          <div className="space-y-2.5">
            {VAULT_ENTRIES.map((v) => (
              <div
                key={v.name}
                className="rounded-lg border border-slate-800 bg-[#090D16] px-3.5 py-2.5"
              >
                <div className="text-xs font-medium text-slate-200">{v.name}</div>
                <div className="mt-1 text-[11px] text-slate-400">{v.scope}</div>
                <div className="mt-0.5 font-mono text-[11px] text-emerald-400/90">
                  {v.storage}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Security Audit Log */}
        <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Immutable Security Audit Log
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {auditLog.length} events
            </span>
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {auditLog.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-slate-800 bg-[#090D16] px-3.5 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-200">
                    {entry.actor} · <span className="font-mono text-sky-300">{entry.action}</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {entry.timestamp} · {entry.decision}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{entry.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
