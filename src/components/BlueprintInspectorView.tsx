import {useState} from 'react';
import {
  BLUEPRINT_SUBSYSTEMS,
  ENGINEERING_TEAMS,
  LOCKED_CONTRACTS,
  ROADMAP_PHASES,
  TECH_LICENSING_MATRIX,
} from '../data/presetsAndBlueprint';

type InspectorTab = 'subsystems' | 'contracts' | 'licensing' | 'teams' | 'roadmap';

export function BlueprintInspectorView() {
  const [tab, setTab] = useState<InspectorTab>('subsystems');
  const [selectedSubsystemId, setSelectedSubsystemId] = useState<number>(7);
  const [selectedContractId, setSelectedContractId] = useState<string>('contract-ir');

  const activeSubsystem =
    BLUEPRINT_SUBSYSTEMS.find((s) => s.id === selectedSubsystemId) ?? BLUEPRINT_SUBSYSTEMS[0];
  const activeContract =
    LOCKED_CONTRACTS.find((c) => c.id === selectedContractId) ?? LOCKED_CONTRACTS[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold text-slate-100">
              Moe Technologies Technical Blueprint v2.0
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Proposed Architecture Baseline · Windows / Linux / macOS · 8GB RAM CPU-only capable · Local-first, AI-model-independent
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#090D16] p-1 shrink-0">
            {(
              [
                {id: 'subsystems', label: '17 Subsystems'},
                {id: 'contracts', label: '6 Contracts'},
                {id: 'licensing', label: 'Tech & Licensing'},
                {id: 'teams', label: 'Teams 1–6'},
                {id: 'roadmap', label: 'Roadmap & Gates'},
              ] as {id: InspectorTab; label: string}[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {tab === 'subsystems' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5 lg:col-span-7">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-100">
              System Topology (Click any subsystem to inspect)
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BLUEPRINT_SUBSYSTEMS.map((sub) => {
                const selected = sub.id === activeSubsystem.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubsystemId(sub.id)}
                    className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                      selected
                        ? 'border-sky-500/50 bg-sky-500/10'
                        : 'border-slate-800 bg-[#090D16] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-mono tabular-nums">
                        {String(sub.id).padStart(2, '0')}
                      </span>
                      <span>{sub.layer}</span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-100">{sub.name}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5 lg:col-span-5 space-y-4">
            <div>
              <div className="text-xs text-sky-400 font-mono">
                Subsystem {String(activeSubsystem.id).padStart(2, '0')} · {activeSubsystem.layer}
              </div>
              <h3 className="mt-1 font-display text-base font-semibold text-slate-100">
                {activeSubsystem.name}
              </h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{activeSubsystem.desc}</p>
            </div>

            <div className="border-t border-slate-800/80 pt-3">
              <div className="text-[11px] text-slate-500">Primary Implementation Stack</div>
              <div className="mt-1 font-mono text-xs text-slate-200">{activeSubsystem.stack}</div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5 text-xs text-slate-400 leading-relaxed">
              Core Principle: AI models decide WHAT should be done. Moe Execution Engine controls HOW authorized actions are executed across operating systems.
            </div>
          </section>
        </div>
      )}

      {tab === 'contracts' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-4 lg:col-span-5 space-y-1.5">
            <h2 className="mb-2 px-2 font-display text-sm font-semibold text-slate-100">
              6 Locked Interface Contracts
            </h2>
            {LOCKED_CONTRACTS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedContractId(c.id)}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                  c.id === activeContract.id
                    ? 'border-sky-500/50 bg-sky-500/10'
                    : 'border-slate-800 bg-[#090D16] hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold text-slate-100">{c.name}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">{c.owner}</div>
              </button>
            ))}
          </section>

          <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5 lg:col-span-7 space-y-4">
            <div>
              <div className="text-xs font-mono text-sky-400">{activeContract.owner}</div>
              <h3 className="mt-1 font-display text-base font-semibold text-slate-100">
                {activeContract.name}
              </h3>
              <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                {activeContract.summary}
              </p>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-[#090D16] p-4 font-mono text-xs leading-relaxed text-sky-200/90">
              {activeContract.spec}
            </pre>
          </section>
        </div>
      )}

      {tab === 'licensing' && (
        <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] overflow-hidden">
          <div className="border-b border-slate-800/80 px-5 py-3.5">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Technology Decisions & Commercial Licensing Review
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800/80 bg-[#090D16] text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Technology</th>
                  <th className="px-4 py-2.5 font-medium">Role in Moe</th>
                  <th className="px-4 py-2.5 font-medium">Decision</th>
                  <th className="px-4 py-2.5 font-medium">License</th>
                  <th className="px-4 py-2.5 font-medium">Architectural Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {TECH_LICENSING_MATRIX.map((row) => (
                  <tr key={row.tech}>
                    <td className="px-4 py-3 font-semibold text-slate-100 whitespace-nowrap">
                      {row.tech}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{row.role}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      <span
                        className={
                          row.decision === 'Adopt' || row.decision === 'Primary'
                            ? 'text-emerald-400'
                            : row.decision === 'Secondary'
                              ? 'text-sky-400'
                              : 'text-amber-400'
                        }
                      >
                        {row.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                      {row.license}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'teams' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ENGINEERING_TEAMS.map((team) => (
            <section
              key={team.id}
              className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5"
            >
              <div className="font-mono text-xs text-sky-400">{team.id}</div>
              <h2 className="mt-1 font-display text-base font-semibold text-slate-100">
                {team.name}
              </h2>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{team.scope}</p>
            </section>
          ))}
        </div>
      )}

      {tab === 'roadmap' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-100">
              First 90-Day Target Execution Sequence
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-[#090D16] p-4">
                <div className="font-mono text-xs text-sky-400">Month 1 · Foundation</div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Tauri + Svelte Desktop, Rust Core, Universal IR v1, SQLite State, Local IPC, Basic Permission System.
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#090D16] p-4">
                <div className="font-mono text-xs text-emerald-400">Month 2 · Execution</div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Execution Engine, Task Scheduler, Connector SDK, Event Journal, Checkpoint / Recovery, Word & Excel Basic Adapter.
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#090D16] p-4">
                <div className="font-mono text-xs text-amber-400">Month 3 · Working Product</div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  AI Planner, Local + Cloud Model Router, Office Integration, Semantic Task Visualization, Win/Linux/macOS Testing.
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ROADMAP_PHASES.map((p) => (
              <div
                key={p.phase}
                className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-4"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-sky-400">{p.phase}</span>
                  <span className="font-mono text-slate-500">{p.month}</span>
                </div>
                <h3 className="mt-1 font-display text-sm font-semibold text-slate-100">
                  {p.title}
                </h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {p.items.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
