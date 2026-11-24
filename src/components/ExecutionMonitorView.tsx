import {AlertTriangle, CheckCircle2, Database, RotateCcw, Zap} from 'lucide-react';
import type {TaskRun} from '../types/workforce';

interface ExecutionMonitorViewProps {
  tasks: TaskRun[];
  activeTask: TaskRun | null;
  onSelectTask: (taskId: string) => void;
  onSimulateCrash: (taskId: string) => void;
  onRecoverTask: (taskId: string) => void;
}

export function ExecutionMonitorView({
  tasks,
  activeTask,
  onSelectTask,
  onSimulateCrash,
  onRecoverTask,
}: ExecutionMonitorViewProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-lg font-semibold text-slate-100">
              Durable Execution & Recovery Monitor
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Native Rust Execution Engine backed by SQLite WAL checkpoints, idempotency keys, and OpenTelemetry GenAI trace spans.
            </p>
          </div>
          {activeTask && (
            <div className="flex items-center gap-2">
              {activeTask.status === 'RUNNING' && (
                <button
                  type="button"
                  onClick={() => onSimulateCrash(activeTask.taskId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Simulate Process Crash</span>
                </button>
              )}
              {activeTask.status === 'PAUSED' && (
                <button
                  type="button"
                  onClick={() => onRecoverTask(activeTask.taskId)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Resume from Safe Checkpoint</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Persisted Task Queue Table */}
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            SQLite WAL Task State Ledger
          </h2>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {tasks.length} persisted tasks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800/80 bg-[#090D16] text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Task ID</th>
                <th className="px-4 py-2.5 font-medium">Directive</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Idempotency Key</th>
                <th className="px-4 py-2.5 font-medium text-right">Checkpoints</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {tasks.map((task) => {
                const isSelected = activeTask?.taskId === task.taskId;
                return (
                  <tr
                    key={task.taskId}
                    onClick={() => onSelectTask(task.taskId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-500/10' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-slate-200 whitespace-nowrap">
                      {task.taskId}
                    </td>
                    <td className="px-4 py-2.5 text-slate-200 max-w-xs truncate">
                      {task.title}
                    </td>
                    <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                      <span
                        className={
                          task.status === 'COMPLETED'
                            ? 'text-emerald-400'
                            : task.status === 'PAUSED' || task.status === 'WAITING_APPROVAL'
                              ? 'text-amber-400'
                              : task.status === 'CANCELLED' || task.status === 'FAILED'
                                ? 'text-red-400'
                                : 'text-sky-400'
                        }
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-400 whitespace-nowrap">
                      {task.ir.execution.idempotency_key}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-300 text-right tabular-nums">
                      {task.checkpoints.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {activeTask && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* SQLite WAL Checkpoint Journal */}
          <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-sky-400" />
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  Durable Checkpoint & Event Journal
                </h2>
              </div>
              <span className="font-mono text-[11px] text-slate-400">SQLite WAL</span>
            </div>

            <div className="mb-3 rounded-lg border border-slate-800 bg-[#090D16] px-3.5 py-2.5 text-xs text-slate-400 leading-relaxed">
              Retrying an external operation is not universally safe. Steps marked with external side effects enforce idempotency keys and reconciliation instead of blind replay.
            </div>

            {activeTask.checkpoints.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                No checkpoints committed yet. Approve or start execution to record WAL entries.
              </p>
            ) : (
              <div className="space-y-2">
                {activeTask.checkpoints.map((cp) => (
                  <div
                    key={cp.checkpoint_id}
                    className="rounded-lg border border-slate-800 bg-[#090D16] px-3.5 py-2.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-mono text-slate-200">
                        {cp.status === 'PAUSED_AT_CRASH' ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        <span>
                          WAL #{cp.wal_seq} · {cp.step_id}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {cp.timestamp}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{cp.note}</p>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">
                      {cp.status} · key: {cp.idempotency_key}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* OpenTelemetry GenAI Trace Waterfall */}
          <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-100">
                OpenTelemetry GenAI Trace Tree
              </h2>
              <span className="font-mono text-[11px] text-slate-400">
                PII & Credentials Redacted
              </span>
            </div>

            <div className="space-y-2">
              {activeTask.otelSpans.map((span) => (
                <div
                  key={span.span_id}
                  className="rounded-lg border border-slate-800 bg-[#090D16] px-3.5 py-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sky-400">{span.stage}</span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-200 truncate">{span.component}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-300 tabular-nums shrink-0">
                      {span.duration_ms} ms
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500 truncate">
                    {span.attributes}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
