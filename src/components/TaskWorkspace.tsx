import {useEffect, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  LogOut,
  Mail,
  Play,
  Presentation,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {PRESET_SCENARIOS} from '../data/presetsAndBlueprint';
import {downloadResearchExcel} from '../lib/excelBuilder';
import type {
  LifecycleStatus,
  OperatingMode,
  PresetScenario,
  RiskLevel,
  TargetOS,
  TaskRun,
} from '../types/workforce';
import {GoogleSignInButton} from './GoogleSignInButton';

interface TaskWorkspaceProps {
  activeTask: TaskRun | null;
  operatingMode: OperatingMode;
  targetOs: TargetOS;
  onChangeTargetOs: (os: TargetOS) => void;
  onLaunchPreset: (preset: PresetScenario) => void;
  onSubmitCustomPrompt: (prompt: string) => Promise<void>;
  onApproveTask: (taskId: string) => void;
  onRejectTask: (taskId: string) => void;
  onSimulateCrash: (taskId: string) => void;
  onRecoverTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onOpenMonitor: () => void;
  plannerLoading: boolean;
  plannerError: string | null;
  researchLoading: boolean;
  researchError: string | null;
  killSwitchActive: boolean;
  googleUserEmail: string | null;
  googleAuthLoading: boolean;
  googleAuthError: string | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onSendGmailReport: (taskId: string, recipient: string) => Promise<void>;
  gmailSending: boolean;
  gmailSendError: string | null;
}

const LIFECYCLE_STAGES: LifecycleStatus[] = [
  'RECEIVED',
  'VALIDATING',
  'PLANNING',
  'WAITING_APPROVAL',
  'READY',
  'RUNNING',
  'COMPLETED',
];

function riskLabelClass(risk: RiskLevel) {
  switch (risk) {
    case 'LOW':
      return 'text-emerald-400';
    case 'MEDIUM':
      return 'text-amber-400';
    case 'HIGH':
      return 'text-orange-400';
    case 'CRITICAL':
      return 'text-red-400';
  }
}

export function TaskWorkspace({
  activeTask,
  operatingMode,
  targetOs,
  onChangeTargetOs,
  onLaunchPreset,
  onSubmitCustomPrompt,
  onApproveTask,
  onRejectTask,
  onSimulateCrash,
  onRecoverTask,
  onRetryTask,
  onOpenMonitor,
  plannerLoading,
  plannerError,
  researchLoading,
  researchError,
  killSwitchActive,
  googleUserEmail,
  googleAuthLoading,
  googleAuthError,
  onGoogleSignIn,
  onGoogleLogout,
  onSendGmailReport,
  gmailSending,
  gmailSendError,
}: TaskWorkspaceProps) {
  const [promptInput, setPromptInput] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(
    activeTask?.emailRecipient || 'natterawym@gmail.com',
  );
  const [showGmailConfirmModal, setShowGmailConfirmModal] = useState(false);

  useEffect(() => {
    if (activeTask?.emailRecipient) {
      setRecipientEmail(activeTask.emailRecipient);
    }
  }, [activeTask?.taskId, activeTask?.emailRecipient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || plannerLoading || killSwitchActive) return;
    await onSubmitCustomPrompt(promptInput.trim());
  };

  const completedSteps =
    activeTask?.steps.filter((s) => s.status === 'completed').length ?? 0;
  const totalSteps = activeTask?.steps.length ?? 0;
  const researchReport = activeTask?.artifactPreview.researchReport;

  const readyToSendGmail =
    Boolean(activeTask) &&
    Boolean(researchReport) &&
    !activeTask?.gmailSentMessageId &&
    activeTask?.status !== 'CANCELLED';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Google Workspace Gmail Connection Bar */}
      <section className="flex flex-col gap-3 rounded-xl border border-slate-800/90 bg-[#131B2E] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Mail className="h-4 w-4 shrink-0 text-sky-400" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-100">
              Gmail Workspace Integration
            </div>
            <div className="text-xs text-slate-400 truncate">
              {googleUserEmail
                ? `Connected as ${googleUserEmail} · Ready to send bilingual reports & .xlsx attachments`
                : 'Sign in with Google to send generated reports and Excel files directly via Gmail.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {googleUserEmail ? (
            <button
              type="button"
              onClick={onGoogleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#090D16] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Disconnect Google</span>
            </button>
          ) : (
            <GoogleSignInButton
              onClick={onGoogleSignIn}
              disabled={googleAuthLoading}
              label={googleAuthLoading ? 'Signing in...' : 'Sign in with Google'}
            />
          )}
        </div>
      </section>

      {googleAuthError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{googleAuthError}</span>
        </div>
      )}

      {/* Command Composer */}
      <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-lg font-semibold text-slate-100">
              AI Workforce Command Center
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Natural-language directives compile into typed Universal Task IR v1.0, execute live 2026 search grounding, export Excel (.xlsx), and dispatch via Gmail.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#090D16] p-1">
            {(['windows', 'linux', 'macos'] as TargetOS[]).map((os) => (
              <button
                key={os}
                type="button"
                onClick={() => onChangeTargetOs(os)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  targetOs === os
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {os === 'macos' ? 'macOS' : os}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              disabled={plannerLoading || killSwitchActive}
              placeholder="Describe a task (e.g., Research 2026 Activepieces, n8n, OpenClaw, make bilingual Excel, email natterawym@gmail.com)..."
              className="flex-1 rounded-lg border border-slate-700/80 bg-[#090D16] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={plannerLoading || !promptInput.trim() || killSwitchActive}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              {plannerLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Planning Universal IR</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Generate Execution Plan</span>
                </>
              )}
            </button>
          </div>

          {killSwitchActive && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
              <span>
                Global Kill Switch is active. Release the Kill Switch in the top bar or Permissions Center before dispatching new tasks.
              </span>
            </div>
          )}

          {(plannerError || researchError) && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="font-medium text-amber-300">{plannerError || researchError}</p>
              </div>
            </div>
          )}

          {/* Preset Scenarios */}
          <div className="pt-1">
            <div className="mb-2 text-xs text-slate-400">
              Preset Workflows ({operatingMode} mode · {targetOs === 'macos' ? 'macOS' : targetOs})
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PRESET_SCENARIOS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={killSwitchActive || plannerLoading}
                  onClick={() => {
                    setPromptInput(preset.prompt);
                    onLaunchPreset(preset);
                  }}
                  className={`group rounded-lg border px-3.5 py-2.5 text-left transition-colors disabled:opacity-40 ${
                    preset.liveResearchMode
                      ? 'border-sky-500/40 bg-sky-500/5 hover:border-sky-400/60 hover:bg-sky-500/10'
                      : 'border-slate-800 bg-[#090D16] hover:border-slate-700 hover:bg-slate-900/90'
                  }`}
                >
                  <div className="text-[11px] text-slate-400">
                    {preset.category} · {preset.ir.risk_level} Risk
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-100 group-hover:text-sky-300 truncate">
                    {preset.title}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>

      {/* Active Task View */}
      {!activeTask ? (
        <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-10 text-center">
          <h2 className="font-display text-base font-semibold text-slate-200">
            No Active Workforce Task
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-xs text-slate-400 leading-relaxed">
            Select the 2026 Activepieces vs n8n vs OpenClaw preset or enter any instruction above to plan Universal Task IR, run live search grounding, export an Excel file, and send via Gmail.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Lifecycle Progress Bar */}
          <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-slate-300">{activeTask.taskId}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeTask.selectedModel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{activeTask.operatingMode} mode</span>
                </div>
                <h2 className="mt-0.5 font-display text-base font-semibold text-slate-100 truncate">
                  {activeTask.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {activeTask.status === 'RUNNING' && !researchLoading && (
                  <button
                    type="button"
                    onClick={() => onSimulateCrash(activeTask.taskId)}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
                  >
                    Simulate Crash
                  </button>
                )}
                {activeTask.status === 'PAUSED' && (
                  <button
                    type="button"
                    onClick={() => onRecoverTask(activeTask.taskId)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Recover from Checkpoint</span>
                  </button>
                )}
                {activeTask.status === 'FAILED' && (
                  <button
                    type="button"
                    disabled={killSwitchActive || researchLoading}
                    onClick={() => onRetryTask(activeTask.taskId)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Retry Execution</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenMonitor}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <span>Trace & WAL</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
              {LIFECYCLE_STAGES.map((stage) => {
                const currentIdx = LIFECYCLE_STAGES.indexOf(
                  activeTask.status === 'PAUSED' || activeTask.status === 'FAILED'
                    ? 'RUNNING'
                    : activeTask.status === 'CANCELLED'
                      ? 'WAITING_APPROVAL'
                      : activeTask.status,
                );
                const stageIdx = LIFECYCLE_STAGES.indexOf(stage);
                const isDone =
                  activeTask.status === 'COMPLETED' ||
                  (currentIdx > stageIdx && activeTask.status !== 'CANCELLED');
                const isCurrent =
                  activeTask.status === stage ||
                  ((activeTask.status === 'PAUSED' || activeTask.status === 'FAILED') &&
                    stage === 'RUNNING');

                return (
                  <div
                    key={stage}
                    className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                      isCurrent
                        ? activeTask.status === 'FAILED'
                          ? 'border-red-500/50 bg-red-500/10 text-red-300'
                          : activeTask.status === 'WAITING_APPROVAL' || activeTask.status === 'PAUSED'
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                            : activeTask.status === 'COMPLETED'
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                              : 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                        : isDone
                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400/90'
                          : 'border-slate-800 bg-[#090D16] text-slate-500'
                    }`}
                  >
                    {stage}
                  </div>
                );
              })}
            </div>

            {activeTask.status === 'FAILED' && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-red-300">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>
                    {researchError || 'Execution paused due to an upstream error. You can retry directly from the failed step.'}
                  </span>
                </div>
              </div>
            )}

            {activeTask.status === 'CANCELLED' && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>Execution cancelled by operator or policy Kill Switch. State persisted to Audit Log.</span>
              </div>
            )}
          </section>

          {/* Human Approval Gate */}
          {activeTask.status === 'WAITING_APPROVAL' && (
            <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    <span>
                      Human Approval Required · Risk Level: {activeTask.ir.risk_level}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200">{activeTask.ir.approval.reason}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 font-mono text-[11px] text-slate-400">
                    <span>Filesystem: {activeTask.ir.permissions.filesystem.join(', ')}</span>
                    <span>Network: {activeTask.ir.permissions.network.join(', ')}</span>
                    <span>Idempotency: {activeTask.ir.execution.idempotency_key}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRejectTask(activeTask.taskId)}
                    className="rounded-lg border border-slate-700 bg-[#090D16] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    Reject Action
                  </button>
                  <button
                    type="button"
                    onClick={() => onApproveTask(activeTask.taskId)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Approve & Execute</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Explicit Gmail Dispatch Card (when bilingual report + .xlsx are ready) */}
          {readyToSendGmail && researchReport && (
            <section className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                    <Mail className="h-4 w-4 text-sky-400" />
                    <span>Ready to Dispatch Bilingual Report & Excel (.xlsx) via Gmail</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Review the generated Burmese/English report and comparison table below, then send it with the attached Excel workbook (<span className="font-mono text-sky-300">{researchReport.excelFilename}</span>).
                  </p>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
                    <label htmlFor="gmail-recipient" className="text-xs text-slate-400 whitespace-nowrap">
                      Recipient Email:
                    </label>
                    <input
                      id="gmail-recipient"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full max-w-xs rounded-lg border border-slate-700 bg-[#090D16] px-3 py-1.5 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadResearchExcel(researchReport)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#090D16] px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Download Excel (.xlsx)</span>
                  </button>

                  {googleUserEmail ? (
                    <button
                      type="button"
                      disabled={gmailSending || !recipientEmail.trim()}
                      onClick={() => setShowGmailConfirmModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {gmailSending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Sending via Gmail...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Send Report & Excel via Gmail</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <GoogleSignInButton
                      onClick={onGoogleSignIn}
                      disabled={googleAuthLoading}
                      label="Sign in with Google to Send"
                    />
                  )}
                </div>
              </div>

              {gmailSendError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>{gmailSendError}</span>
                </div>
              )}
            </section>
          )}

          {activeTask.gmailSentMessageId && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3.5 text-xs text-emerald-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  Email with bilingual report and <span className="font-mono">{researchReport?.excelFilename}</span> sent to{' '}
                  <strong className="text-emerald-100">{recipientEmail}</strong> (Gmail Message ID:{' '}
                  <span className="font-mono">{activeTask.gmailSentMessageId}</span>)
                </span>
              </div>
              {researchReport && (
                <button
                  type="button"
                  onClick={() => downloadResearchExcel(researchReport)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-[#090D16] px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-slate-900 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Excel (.xlsx)</span>
                </button>
              )}
            </section>
          )}

          {/* Main 2-Column Split: Semantic Execution + Artifact Preview | Universal IR */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Left 7 Cols: Semantic Execution & Output Preview */}
            <div className="space-y-6 lg:col-span-7">
              <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-100">
                      Semantic Execution Pipeline
                    </h3>
                    <p className="text-xs text-slate-400">
                      {researchLoading
                        ? 'Executing live 2026 Google Search Grounding & compiling bilingual Excel workbook...'
                        : 'Meaningful execution milestones & checkpoint commits'}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-300 tabular-nums">
                    {completedSteps} / {totalSteps} steps
                  </span>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {activeTask.steps.map((step, index) => (
                    <div key={step.step_id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 shrink-0">
                            {step.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : step.status === 'running' ? (
                              <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                            ) : step.status === 'paused' ? (
                              <AlertTriangle className="h-4 w-4 text-amber-400" />
                            ) : step.status === 'cancelled' ? (
                              <XCircle className="h-4 w-4 text-red-400" />
                            ) : (
                              <Clock className="h-4 w-4 text-slate-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-medium text-slate-100">
                                {index + 1}. {step.action_label}
                              </span>
                              <span className="text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-slate-400">{step.agent}</span>
                            </div>
                            <p
                              className={`mt-1 text-xs leading-relaxed ${
                                step.status === 'completed'
                                  ? 'text-emerald-300/90'
                                  : step.status === 'running'
                                    ? 'text-sky-300'
                                    : step.status === 'paused'
                                      ? 'text-amber-300'
                                      : 'text-slate-400'
                              }`}
                            >
                              {step.semantic_milestone}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-500">
                              <span>{step.adapter_resolved}</span>
                              <span>key: {step.idempotency_key}</span>
                              {step.external_side_effect && (
                                <span className="text-amber-400">external side-effect</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                          {step.duration_ms ? `${step.duration_ms} ms` : `~${step.estimated_ms} ms`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Artifact Output Preview */}
              <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {activeTask.artifactPreview.kind === 'spreadsheet' ? (
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : activeTask.artifactPreview.kind === 'presentation' ? (
                      <Presentation className="h-4 w-4 shrink-0 text-amber-400" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-sky-400" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-semibold text-slate-100 truncate">
                        Output Artifact: {researchReport?.excelFilename || activeTask.artifactPreview.filename}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">
                        {researchReport?.reportTitleEn || activeTask.artifactPreview.headline}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {researchReport && (
                      <button
                        type="button"
                        onClick={() => downloadResearchExcel(researchReport)}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <Download className="h-3 w-3" />
                        <span>.xlsx</span>
                      </button>
                    )}
                    <span className="font-mono text-[11px] text-slate-400">
                      {activeTask.status === 'COMPLETED' ? 'Verified' : 'Staged Preview'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y border-slate-800/80 py-3 sm:grid-cols-4">
                  {activeTask.artifactPreview.summaryMetrics.map((m) => (
                    <div key={m.label}>
                      <div className="text-[11px] text-slate-500">{m.label}</div>
                      <div className="mt-0.5 font-mono text-sm font-semibold text-slate-100 tabular-nums">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {researchReport ? (
                  <div className="mt-4 space-y-5">
                    {/* Bilingual Executive Summary */}
                    <div className="space-y-2 rounded-lg border border-slate-800 bg-[#090D16] p-4">
                      <div className="text-xs font-semibold text-sky-300">
                        {researchReport.reportTitleEn}
                      </div>
                      <div className="text-xs font-semibold text-emerald-300">
                        {researchReport.reportTitleMm}
                      </div>
                      <p className="pt-1 text-xs text-slate-200 leading-relaxed">
                        {researchReport.executiveSummaryEn}
                      </p>
                      <p className="border-t border-slate-800/80 pt-2 text-xs text-slate-300 leading-relaxed">
                        {researchReport.executiveSummaryMm}
                      </p>
                    </div>

                    {/* Bilingual Comparison Matrix Table */}
                    <div>
                      <div className="mb-2 text-xs font-semibold text-slate-200">
                        Comparison Table (English &amp; မြန်မာ) — Included in Excel Sheet 1
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-slate-800">
                        <table className="w-full text-left text-[11px]">
                          <thead className="border-b border-slate-800 bg-[#090D16] text-slate-400">
                            <tr>
                              <th className="px-3 py-2 font-medium">Criterion / ခေါင်းစဉ်</th>
                              <th className="px-3 py-2 font-medium">Activepieces</th>
                              <th className="px-3 py-2 font-medium">n8n</th>
                              <th className="px-3 py-2 font-medium">OpenClaw</th>
                              <th className="px-3 py-2 font-medium">Notes (မြန်မာ)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70 bg-[#090D16]/60">
                            {researchReport.tableRows.map((row, i) => (
                              <tr key={`${row.criterion_en}-${i}`}>
                                <td className="px-3 py-2.5 align-top">
                                  <div className="font-medium text-slate-100">{row.criterion_en}</div>
                                  <div className="mt-0.5 text-slate-400">{row.criterion_mm}</div>
                                </td>
                                <td className="px-3 py-2.5 align-top text-slate-300">
                                  {row.activepieces}
                                </td>
                                <td className="px-3 py-2.5 align-top text-slate-300">{row.n8n}</td>
                                <td className="px-3 py-2.5 align-top text-slate-300">
                                  {row.openclaw}
                                </td>
                                <td className="px-3 py-2.5 align-top text-emerald-200/90">
                                  {row.notes_mm}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Detailed Sections */}
                    <div className="space-y-2.5">
                      {researchReport.detailedSections.map((sec, idx) => (
                        <div
                          key={`${sec.headingEn}-${idx}`}
                          className="rounded-lg border border-slate-800/80 bg-[#090D16] p-3.5"
                        >
                          <div className="text-xs font-semibold text-slate-100">
                            {sec.headingEn} · <span className="text-sky-300">{sec.headingMm}</span>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                            {sec.bodyEn}
                          </p>
                          <p className="mt-1.5 border-t border-slate-800/70 pt-1.5 text-xs text-slate-300 leading-relaxed">
                            {sec.bodyMm}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Grounded 2026 Sources */}
                    {researchReport.sources.length > 0 && (
                      <div className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-200">
                          <span>Verified 2026 Web Sources ({researchReport.sources.length})</span>
                          {researchReport.searchProvider && (
                            <span className="font-mono text-[11px] font-normal text-sky-400">
                              via {researchReport.searchProvider}
                            </span>
                          )}
                        </div>
                        <ul className="space-y-1.5 text-xs">
                          {researchReport.sources.map((src) => (
                            <li key={src.uri}>
                              <a
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-md">{src.title}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {activeTask.artifactPreview.sections.map((sec) => (
                      <div
                        key={sec.heading}
                        className="rounded-lg border border-slate-800/80 bg-[#090D16] px-3.5 py-2.5"
                      >
                        <div className="text-xs font-medium text-slate-200">{sec.heading}</div>
                        <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{sec.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right 5 Cols: Universal Task IR & Policy Assessment */}
            <div className="space-y-6 lg:col-span-5">
              <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-slate-100">
                    Policy & Capability Assessment
                  </h3>
                  <span
                    className={`font-mono text-xs font-semibold ${riskLabelClass(
                      activeTask.ir.risk_level,
                    )}`}
                  >
                    {activeTask.ir.risk_level} RISK
                  </span>
                </div>

                <dl className="space-y-2.5 text-xs">
                  <div className="flex justify-between gap-4 border-b border-slate-800/70 pb-2">
                    <dt className="text-slate-400">Router Decision</dt>
                    <dd className="text-right text-slate-200">{activeTask.routingRationale}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-800/70 pb-2">
                    <dt className="text-slate-400">Capability Contract</dt>
                    <dd className="font-mono text-sky-300 text-right">{activeTask.ir.capability}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-800/70 pb-2">
                    <dt className="text-slate-400">Idempotency Key</dt>
                    <dd className="font-mono text-slate-300 text-right">
                      {activeTask.ir.execution.idempotency_key}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Output Target</dt>
                    <dd className="font-mono text-slate-300 text-right truncate max-w-[230px]">
                      {activeTask.ir.target.output_path}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-xl border border-slate-800/90 bg-[#131B2E] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-slate-100">
                    Universal Task IR v1.0
                  </h3>
                  <span className="font-mono text-[11px] text-slate-500">
                    schema_version: {activeTask.ir.schema_version}
                  </span>
                </div>
                <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-800 bg-[#090D16] p-3.5 font-mono text-[11px] leading-relaxed text-sky-200/90">
                  {JSON.stringify(activeTask.ir, null, 2)}
                </pre>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Gmail Send Confirmation Modal */}
      {showGmailConfirmModal && activeTask && researchReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-[#131B2E] p-6 shadow-xl">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
              <Mail className="h-4 w-4 text-sky-400" />
              <span>Confirm Gmail Dispatch</span>
            </div>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              This will send an email from your connected Google account (<span className="font-mono text-sky-300">{googleUserEmail}</span>) with the bilingual report and attached Excel workbook.
            </p>

            <dl className="mt-4 space-y-2 rounded-lg border border-slate-800 bg-[#090D16] p-3.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">To</dt>
                <dd className="font-mono text-slate-100">{recipientEmail}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Subject</dt>
                <dd className="text-right text-slate-200 truncate max-w-[240px]">
                  {researchReport.reportTitleEn}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Attachment</dt>
                <dd className="font-mono text-emerald-300 truncate max-w-[240px]">
                  {researchReport.excelFilename}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowGmailConfirmModal(false)}
                className="rounded-lg border border-slate-700 bg-[#090D16] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowGmailConfirmModal(false);
                  await onSendGmailReport(activeTask.taskId, recipientEmail.trim());
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Confirm &amp; Send Email</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
