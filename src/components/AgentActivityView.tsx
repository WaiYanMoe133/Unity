import {Bot, CheckCircle2, Lock, ShieldCheck, Workflow} from 'lucide-react';
import type {TaskRun} from '../types/workforce';

interface AgentActivityViewProps {
  activeTask: TaskRun | null;
}

const AGENT_HIERARCHY = [
  {
    role: 'Main Orchestrator',
    tier: 'Coordinator',
    capabilities: ['lifecycle.manage', 'budget.enforce', 'human.gate'],
    contextIsolation: 'Session Root Context (Read-Only Memory Index)',
    desc: 'Receives user requests, coordinates handoffs, enforces token/timeout budgets, and aggregates final outputs.',
  },
  {
    role: 'Planner Agent',
    tier: 'Reasoning',
    capabilities: ['ir.emit', 'plan.decompose'],
    contextIsolation: 'Isolated Planning Context · Shared LLM Runtime',
    desc: 'Decomposes instructions into typed Universal Task IR v1.0 without holding OS execution credentials.',
  },
  {
    role: 'Office Agent',
    tier: 'Specialized',
    capabilities: ['office.word', 'office.excel', 'office.powerpoint', 'office.outlook'],
    contextIsolation: 'Task-Scoped Buffer · Office.js / COM / UNO Bridge',
    desc: 'Executes semantic document, spreadsheet, and presentation operations through negotiated OS adapters.',
  },
  {
    role: 'Research Agent',
    tier: 'Specialized',
    capabilities: ['web.research', 'local.inference', 'mcp.read'],
    contextIsolation: 'Ephemeral Retrieval Context',
    desc: 'Queries MCP 2026 connectors or local semantic indexes without write access to user workspaces.',
  },
  {
    role: 'Data Analysis Agent',
    tier: 'Specialized',
    capabilities: ['spreadsheet.analyze', 'data.synthesize'],
    contextIsolation: 'Bounded Numeric Sandbox',
    desc: 'Normalizes multi-sheet schemas, validates totals, and flags duplicate financial records.',
  },
  {
    role: 'File Management Agent',
    tier: 'Specialized',
    capabilities: ['filesystem.read', 'filesystem.write', 'document.read'],
    contextIsolation: 'Path-Scoped Rust Handle Only',
    desc: 'Resolves authorized workspace paths and streams document handles into Wasmtime or Office adapters.',
  },
  {
    role: 'Browser Agent',
    tier: 'Specialized',
    capabilities: ['browser.navigate', 'browser.extract'],
    contextIsolation: 'Isolated Session Profile',
    desc: 'Performs controlled web extraction with domain allowlists and prompt-injection sanitization.',
  },
  {
    role: 'Coding Agent',
    tier: 'Specialized',
    capabilities: ['code.analyze', 'code.patch'],
    contextIsolation: 'Workspace Repository Scope',
    desc: 'Generates and tests scripts or structured transforms inside policy-approved project directories.',
  },
  {
    role: 'Voice Agent',
    tier: 'Specialized',
    capabilities: ['stt.transcribe', 'tts.synthesize'],
    contextIsolation: 'Audio Stream Buffer (Lazy Unload)',
    desc: 'Handles local Whisper STT and Moe TTS Burmese/English speech streams on demand.',
  },
  {
    role: 'Reviewer Agent',
    tier: 'Verification',
    capabilities: ['artifact.verify', 'policy.reconcile'],
    contextIsolation: 'Read-Only Verification Context · Shared LLM Runtime',
    desc: 'Audits completed artifacts against original goals, checks checksums, and flags incomplete steps.',
  },
];

export function AgentActivityView({activeTask}: AgentActivityViewProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-lg font-semibold text-slate-100">
              Hierarchical Multi-Agent Orchestrator
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Multiple agents share a single loaded LLM runtime to stay within 8GB RAM while preserving isolated logical contexts and capability-scoped tool grants.
            </p>
          </div>
          <div className="font-mono text-xs text-slate-300">
            Shared Runtime: 1 Active Instance · 10 Registered Roles
          </div>
        </div>
      </section>

      {/* Active Task Handoff Chain */}
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-sky-400" />
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Live Agent Handoff Sequence
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-400">
            {activeTask ? `${activeTask.taskId} · ${activeTask.status}` : 'Idle'}
          </span>
        </div>

        {!activeTask ? (
          <p className="text-xs text-slate-400">
            Start or select a workflow in Task Workspace to inspect live inter-agent handoffs.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {activeTask.steps.map((step, idx) => (
              <div
                key={step.step_id}
                className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono">Handoff {idx + 1}</span>
                  <span
                    className={`font-mono capitalize ${
                      step.status === 'completed'
                        ? 'text-emerald-400'
                        : step.status === 'running'
                          ? 'text-sky-400'
                          : step.status === 'paused'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
                <div className="mt-1.5 text-xs font-semibold text-slate-100">{step.agent}</div>
                <div className="mt-1 text-xs text-slate-400 leading-snug">
                  {step.action_label}
                </div>
                <div className="mt-2 font-mono text-[11px] text-sky-300/80">
                  Grant: {step.capability}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Registered Agent Roster */}
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] overflow-hidden">
        <div className="border-b border-slate-800/80 px-5 py-3.5">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Agent Runtime Isolation & Capability Scope
          </h2>
        </div>

        <div className="divide-y divide-slate-800/70">
          {AGENT_HIERARCHY.map((agent) => {
            const activeInCurrentTask = activeTask?.steps.some(
              (s) => s.agent.toLowerCase() === agent.role.toLowerCase(),
            );
            return (
              <div
                key={agent.role}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Bot className="h-4 w-4 text-sky-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-100">{agent.role}</span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs text-slate-400">{agent.tier}</span>
                    {activeInCurrentTask && (
                      <>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Assigned to current task</span>
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{agent.desc}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span>{agent.contextIsolation}</span>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Least-Privilege Grants</span>
                  </span>
                  <div className="font-mono text-[11px] text-sky-300/90 text-left sm:text-right">
                    {agent.capabilities.join(' · ')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
