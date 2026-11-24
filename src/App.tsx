import {useEffect, useRef, useState} from 'react';
import {AgentActivityView} from './components/AgentActivityView';
import {BlueprintInspectorView} from './components/BlueprintInspectorView';
import {ConnectorsMcpView} from './components/ConnectorsMcpView';
import {ExecutionMonitorView} from './components/ExecutionMonitorView';
import {ModelsMemoryView} from './components/ModelsMemoryView';
import {PermissionsVaultView} from './components/PermissionsVaultView';
import {OfflineIndicator} from './components/PWAInstallButton';
import {Sidebar} from './components/Sidebar';
import {TaskWorkspace} from './components/TaskWorkspace';
import {TopBar} from './components/TopBar';
import {
  INITIAL_AUDIT_LOG,
  INITIAL_CONNECTORS,
  INITIAL_MEMORY_LAYERS,
  INITIAL_MODEL_SLOTS,
  PRESET_SCENARIOS,
} from './data/presetsAndBlueprint';
import {buildBilingualEmailContent, buildResearchExcelBase64} from './lib/excelBuilder';
import {getAccessToken, googleSignIn, initAuth, logout} from './lib/googleAuth';
import type {
  AuditEntry,
  BilingualResearchReport,
  CheckpointRecord,
  ConnectorDef,
  MemoryLayer,
  ModelSlot,
  NavSection,
  OperatingMode,
  PresetScenario,
  TargetOS,
  TaskRun,
  TraceSpan,
} from './types/workforce';

function nowTimestamp(): string {
  return new Date().toLocaleTimeString('en-GB', {hour12: false});
}

async function parseApiResponse<T = Record<string, unknown>>(response: Response): Promise<T> {
  const rawText = await response.text();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') || rawText.trimStart().startsWith('<')) {
    throw new Error(
      `Server returned a non-JSON page (HTTP ${response.status}). If the request timed out or the server restarted, please click Retry Execution.`,
    );
  }
  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(`Invalid JSON received from server (HTTP ${response.status}).`);
  }
}

function buildInitialTaskFromPreset(
  preset: PresetScenario,
  modeOverride?: OperatingMode,
  osOverride?: TargetOS,
  autoRunCompleted = false,
): TaskRun {
  const mode = modeOverride ?? preset.recommendedMode;
  const os = osOverride ?? preset.recommendedOs;
  const needsApproval = preset.ir.approval.required && !autoRunCompleted;

  const steps = preset.steps.map((s) => ({
    ...s,
    status: autoRunCompleted ? ('completed' as const) : ('pending' as const),
    duration_ms: autoRunCompleted ? s.estimated_ms : undefined,
  }));

  const checkpoints: CheckpointRecord[] = autoRunCompleted
    ? steps.map((s, idx) => ({
        checkpoint_id: `cp_${preset.id}_${idx + 1}`,
        task_id: preset.ir.task_id,
        step_id: s.step_id,
        status: 'COMMITTED',
        idempotency_key: s.idempotency_key,
        wal_seq: idx + 1,
        timestamp: nowTimestamp(),
        note: `Safe SQLite WAL commit after "${s.action_label}".`,
      }))
    : [];

  const otelSpans: TraceSpan[] = [
    {
      span_id: 'sp_req',
      stage: 'Request',
      component: 'Tauri IPC Bridge',
      duration_ms: 14,
      status: 'ok',
      attributes: `mode=${mode} os=${os}`,
    },
    {
      span_id: 'sp_plan',
      stage: 'Planner',
      component: 'Planner Agent',
      duration_ms: 340,
      status: 'ok',
      attributes: `model=${preset.selectedModel}`,
    },
    {
      span_id: 'sp_ir',
      stage: 'IR',
      component: 'Universal Task IR v1.0',
      duration_ms: 8,
      status: 'ok',
      attributes: `action=${preset.ir.action} risk=${preset.ir.risk_level}`,
    },
    {
      span_id: 'sp_val',
      stage: 'Validator',
      component: 'Policy & Capability Resolver',
      duration_ms: 21,
      status: needsApproval ? 'waiting' : 'ok',
      attributes: `approval_required=${preset.ir.approval.required}`,
    },
  ];

  return {
    taskId: preset.ir.task_id,
    title: preset.title,
    prompt: preset.prompt,
    operatingMode: mode,
    targetOs: os,
    status: autoRunCompleted ? 'COMPLETED' : needsApproval ? 'WAITING_APPROVAL' : 'RUNNING',
    selectedModel: preset.selectedModel,
    routingRationale: preset.routingRationale,
    createdAt: nowTimestamp(),
    ir: preset.ir,
    steps,
    checkpoints,
    otelSpans,
    artifactPreview: preset.artifactPreview,
    source: 'preset',
    liveResearchMode: preset.liveResearchMode,
    emailRecipient: preset.emailRecipient,
  };
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('workspace');
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('cloud');
  const [targetOs, setTargetOs] = useState<TargetOS>('windows');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [tasks, setTasks] = useState<TaskRun[]>(() => [
    buildInitialTaskFromPreset(PRESET_SCENARIOS[0], 'cloud', 'windows', false),
  ]);
  const [activeTaskId, setActiveTaskId] = useState<string>(PRESET_SCENARIOS[0].ir.task_id);

  const [connectors, setConnectors] = useState<ConnectorDef[]>(INITIAL_CONNECTORS);
  const [modelSlots, setModelSlots] = useState<ModelSlot[]>(INITIAL_MODEL_SLOTS);
  const [memoryLayers, setMemoryLayers] = useState<MemoryLayer[]>(INITIAL_MEMORY_LAYERS);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(INITIAL_AUDIT_LOG);
  const [killSwitchActive, setKillSwitchActive] = useState(false);

  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [gmailSending, setGmailSending] = useState(false);
  const [gmailSendError, setGmailSendError] = useState<string | null>(null);

  const runnerTimerRef = useRef<number | null>(null);
  const researchInFlightRef = useRef<Set<string>>(new Set());

  const activeTask = tasks.find((t) => t.taskId === activeTaskId) ?? null;

  const baseRuntimeRamMb = 540;
  const loadedModelsRamMb = modelSlots.reduce((acc, m) => acc + (m.loaded ? m.ramMb : 0), 0);
  const usedRamMb = baseRuntimeRamMb + loadedModelsRamMb;
  const waitingApprovalCount = tasks.filter((t) => t.status === 'WAITING_APPROVAL').length;

  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setGoogleUserEmail(user.email ?? user.displayName ?? 'Google Account');
      },
      () => {
        if (!getAccessToken()) {
          setGoogleUserEmail(null);
        }
      },
    );
    return () => unsub();
  }, []);

  const appendAudit = (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
    setAuditLog((prev) => [
      {
        id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: nowTimestamp(),
        ...entry,
      },
      ...prev,
    ]);
  };

  const handleGoogleSignIn = async () => {
    setGoogleAuthError(null);
    setGoogleAuthLoading(true);
    try {
      const res = await googleSignIn();
      setGoogleUserEmail(res.user.email ?? res.user.displayName ?? 'Connected Google Account');
      appendAudit({
        actor: 'Google Workspace Auth',
        action: 'oauth.gmail_send_connected',
        risk: 'MEDIUM',
        decision: 'APPROVED',
        detail: `User authenticated with Google (${res.user.email ?? 'account'}) for Gmail dispatch.`,
      });
    } catch (err: unknown) {
      setGoogleAuthError(
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.',
      );
    } finally {
      setGoogleAuthLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUserEmail(null);
  };

  const runLiveResearchForTask = async (task: TaskRun) => {
    if (researchInFlightRef.current.has(task.taskId)) return;
    researchInFlightRef.current.add(task.taskId);
    setResearchLoading(true);
    setResearchError(null);

    try {
      // Step 1: Mark search step running
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === task.taskId
            ? {
                ...t,
                steps: t.steps.map((s, idx) => (idx === 0 ? {...s, status: 'running'} : s)),
              }
            : t,
        ),
      );

      const totalStarted = performance.now();
      let report: BilingualResearchReport;
      let searchDurationMs = 0;

      const searchRes = await fetch('/api/web-search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt: task.prompt}),
      });
      const searchData = await parseApiResponse<{
        externalSearchReady: boolean;
        providerLabel: string | null;
        snippets: {title: string; uri: string; snippet: string}[];
        searchMs: number;
        error?: string;
      }>(searchRes);
      if (!searchRes.ok) {
        throw new Error(searchData.error || 'External live web search failed.');
      }

      if (searchData.externalSearchReady && searchData.snippets.length > 0) {
        searchDurationMs = searchData.searchMs || Math.round(performance.now() - totalStarted);

        // Immediately mark Step 1 completed and Step 2 running
        setTasks((prev) =>
          prev.map((t) =>
            t.taskId === task.taskId
              ? {
                  ...t,
                  steps: t.steps.map((s, idx) => {
                    if (idx === 0) {
                      return {
                        ...s,
                        status: 'completed' as const,
                        duration_ms: searchDurationMs,
                        adapter_resolved: searchData.providerLabel || s.adapter_resolved,
                        semantic_milestone: `Grounded ${searchData.snippets.length} live 2026 web sources via ${searchData.providerLabel}.`,
                      };
                    }
                    if (idx === 1) {
                      return {...s, status: 'running' as const};
                    }
                    return s;
                  }),
                }
              : t,
          ),
        );

        const synthRes = await fetch('/api/synthesize-report', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            prompt: task.prompt,
            providerLabel: searchData.providerLabel,
            snippets: searchData.snippets,
          }),
        });
        const synthData = await parseApiResponse<BilingualResearchReport & {error?: string}>(synthRes);
        if (!synthRes.ok) {
          throw new Error(synthData.error || 'Bilingual report synthesis failed.');
        }
        report = synthData;
      } else {
        // Fallback: Native Gemini Google Search Grounding (single call)
        const response = await fetch('/api/execute-research', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({prompt: task.prompt}),
        });
        const data = await parseApiResponse<BilingualResearchReport & {error?: string}>(response);
        if (!response.ok) {
          throw new Error(data.error || 'Live 2026 web research failed.');
        }
        report = data;
        searchDurationMs = Math.round(performance.now() - totalStarted);
      }

      const elapsedMs = Math.round(performance.now() - totalStarted);
      const synthesisMs = Math.max(200, elapsedMs - searchDurationMs);

      setTasks((prev) =>
        prev.map((t) => {
          if (t.taskId !== task.taskId) return t;
          const hasEmailStep = t.steps.some((s) => s.capability.includes('mail.send'));
          const updatedSteps = t.steps.map((s, idx) => {
            if (idx === 0) {
              return {
                ...s,
                status: 'completed' as const,
                duration_ms: searchDurationMs,
                adapter_resolved: report.searchProvider || s.adapter_resolved,
                semantic_milestone: `Grounded ${report.sources.length} live 2026 web sources via ${report.searchProvider || 'Web Search'}.`,
              };
            }
            if (idx === 1 || (!hasEmailStep && idx > 0)) {
              return {
                ...s,
                status: 'completed' as const,
                duration_ms: synthesisMs,
                semantic_milestone: `Built ${report.tableRows.length}-row bilingual (EN + မြန်မာ) matrix & ${report.excelFilename}.`,
              };
            }
            if (s.capability.includes('mail.send')) {
              return {
                ...s,
                status: 'paused' as const,
                semantic_milestone: `Ready to email ${t.emailRecipient || 'recipient'} — confirm inside the Gmail Dispatch panel above.`,
              };
            }
            return {...s, status: 'completed' as const, duration_ms: 200};
          });

          const nextSeq = t.checkpoints.length + 1;
          const newCheckpoints: CheckpointRecord[] = [
            ...t.checkpoints,
            {
              checkpoint_id: `cp_res_${Date.now()}`,
              task_id: t.taskId,
              step_id: 'step_01',
              status: 'COMMITTED',
              idempotency_key: t.steps[0]?.idempotency_key || 'idem_res_01',
              wal_seq: nextSeq,
              timestamp: nowTimestamp(),
              note: `Committed live 2026 search results (${report.sources.length} sources via ${report.searchProvider || 'Search'}) & bilingual .xlsx workbook.`,
            },
          ];

          return {
            ...t,
            status: hasEmailStep ? 'PAUSED' : 'COMPLETED',
            steps: updatedSteps,
            checkpoints: newCheckpoints,
            otelSpans: [
              ...t.otelSpans,
              {
                span_id: `sp_search_${Date.now()}`,
                stage: 'Connector',
                component: `${report.searchProvider || 'Web Search'} + Gemini Synthesis`,
                duration_ms: elapsedMs,
                status: 'ok',
                attributes: `provider=${report.searchProvider || 'search'} sources=${report.sources.length} rows=${report.tableRows.length} file=${report.excelFilename}`,
              },
            ],
            artifactPreview: {
              ...t.artifactPreview,
              kind: 'spreadsheet',
              filename: report.excelFilename,
              headline: report.reportTitleEn,
              summaryMetrics: [
                {label: 'Grounded Sources', value: String(report.sources.length)},
                {label: 'Table Rows', value: String(report.tableRows.length)},
                {label: 'Languages', value: 'EN + မြန်မာ'},
                {label: 'Format', value: '.xlsx Ready'},
              ],
              researchReport: report,
            },
          };
        }),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Live 2026 research failed.';
      setResearchError(msg);
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === task.taskId
            ? {
                ...t,
                status: 'FAILED',
                steps: t.steps.map((s) => (s.status === 'running' ? {...s, status: 'paused'} : s)),
              }
            : t,
        ),
      );
    } finally {
      researchInFlightRef.current.delete(task.taskId);
      setResearchLoading(false);
    }
  };

  // Execution engine runner loop for standard & live-research tasks
  useEffect(() => {
    if (runnerTimerRef.current) {
      window.clearTimeout(runnerTimerRef.current);
      runnerTimerRef.current = null;
    }

    if (killSwitchActive || !activeTask || activeTask.status !== 'RUNNING') {
      return;
    }

    if (activeTask.liveResearchMode && !activeTask.artifactPreview.researchReport) {
      void runLiveResearchForTask(activeTask);
      return;
    }

    const nextIdx = activeTask.steps.findIndex((s) => s.status === 'pending' || s.status === 'running');
    if (nextIdx === -1) {
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === activeTask.taskId
            ? {
                ...t,
                status: 'COMPLETED',
                otelSpans: [
                  ...t.otelSpans,
                  {
                    span_id: `sp_done_${Date.now()}`,
                    stage: 'Execution Result',
                    component: 'Moe Execution Engine',
                    duration_ms: t.steps.reduce((acc, s) => acc + (s.duration_ms ?? s.estimated_ms), 0),
                    status: 'ok',
                    attributes: `checkpoints=${t.checkpoints.length} verified=true`,
                  },
                ],
              }
            : t,
        ),
      );
      return;
    }

    const currentStep = activeTask.steps[nextIdx];

    if (currentStep.status === 'pending') {
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === activeTask.taskId
            ? {
                ...t,
                steps: t.steps.map((s, idx) => (idx === nextIdx ? {...s, status: 'running'} : s)),
              }
            : t,
        ),
      );
      return;
    }

    runnerTimerRef.current = window.setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.taskId !== activeTask.taskId || t.status !== 'RUNNING') return t;
          const updatedSteps = t.steps.map((s, idx) =>
            idx === nextIdx ? {...s, status: 'completed' as const, duration_ms: s.estimated_ms} : s,
          );
          const nextWalSeq = t.checkpoints.length + 1;
          const newCp: CheckpointRecord = {
            checkpoint_id: `cp_${t.taskId}_${nextWalSeq}`,
            task_id: t.taskId,
            step_id: currentStep.step_id,
            status: 'COMMITTED',
            idempotency_key: currentStep.idempotency_key,
            wal_seq: nextWalSeq,
            timestamp: nowTimestamp(),
            note: currentStep.external_side_effect
              ? `Committed external side-effect reconciliation for "${currentStep.action_label}".`
              : `Safe SQLite WAL checkpoint after "${currentStep.action_label}".`,
          };
          const newSpan: TraceSpan = {
            span_id: `sp_${currentStep.step_id}_${nextWalSeq}`,
            stage: 'Connector',
            component: currentStep.adapter_resolved,
            duration_ms: currentStep.estimated_ms,
            status: 'ok',
            attributes: `agent=${currentStep.agent} capability=${currentStep.capability}`,
          };
          return {
            ...t,
            steps: updatedSteps,
            checkpoints: [...t.checkpoints, newCp],
            otelSpans: [...t.otelSpans, newSpan],
          };
        }),
      );
    }, Math.min(1100, Math.max(600, currentStep.estimated_ms)));

    return () => {
      if (runnerTimerRef.current) {
        window.clearTimeout(runnerTimerRef.current);
      }
    };
  }, [activeTask, killSwitchActive]);

  const handleSendGmailReport = async (taskId: string, recipient: string) => {
    const task = tasks.find((t) => t.taskId === taskId);
    const report = task?.artifactPreview.researchReport;
    if (!task || !report) return;

    const accessToken = getAccessToken();
    if (!accessToken) {
      setGmailSendError('Please sign in with Google first to authorize Gmail sending.');
      return;
    }

    setGmailSendError(null);
    setGmailSending(true);
    try {
      const {base64, filename} = await buildResearchExcelBase64(report);
      const {subject, textBody, htmlBody} = buildBilingualEmailContent(report);

      const started = performance.now();
      const response = await fetch('/api/send-gmail', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipient,
          subject,
          textBody,
          htmlBody,
          xlsxBase64: base64,
          xlsxFilename: filename,
        }),
      });

      const data = await parseApiResponse<{messageId?: string; error?: string}>(response);
      if (response.status === 401) {
        await logout();
        setGoogleUserEmail(null);
        throw new Error('Google OAuth session expired. Please click Sign in with Google and try sending again.');
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to dispatch email via Gmail.');
      }

      const elapsedMs = Math.round(performance.now() - started);

      setTasks((prev) =>
        prev.map((t) => {
          if (t.taskId !== taskId) return t;
          const nextWal = t.checkpoints.length + 1;
          return {
            ...t,
            status: 'COMPLETED',
            emailRecipient: recipient,
            gmailSentMessageId: data.messageId,
            steps: t.steps.map((s) =>
              s.capability.includes('mail.send') || s.status === 'paused'
                ? {
                    ...s,
                    status: 'completed' as const,
                    duration_ms: elapsedMs,
                    semantic_milestone: `Sent bilingual report & ${filename} to ${recipient} (Message ID: ${data.messageId}).`,
                  }
                : s,
            ),
            checkpoints: [
              ...t.checkpoints,
              {
                checkpoint_id: `cp_gmail_${Date.now()}`,
                task_id: t.taskId,
                step_id: 'step_gmail',
                status: 'COMMITTED',
                idempotency_key: t.ir.execution.idempotency_key,
                wal_seq: nextWal,
                timestamp: nowTimestamp(),
                note: `Gmail API dispatched message ${data.messageId} with ${filename} to ${recipient}.`,
              },
            ],
            otelSpans: [
              ...t.otelSpans,
              {
                span_id: `sp_gmail_${Date.now()}`,
                stage: 'Execution Result',
                component: 'Google Gmail API (gmail.send)',
                duration_ms: elapsedMs,
                status: 'ok',
                attributes: `to=${recipient} attachment=${filename} msg_id=${data.messageId}`,
              },
            ],
          };
        }),
      );

      appendAudit({
        actor: 'Gmail Connector (OAuth)',
        action: `mail.send -> ${recipient}`,
        risk: 'HIGH',
        decision: 'APPROVED',
        detail: `Dispatched bilingual report & ${filename} (Gmail Message ID: ${data.messageId}).`,
      });
    } catch (err: unknown) {
      setGmailSendError(err instanceof Error ? err.message : 'Failed to send email.');
    } finally {
      setGmailSending(false);
    }
  };

  const handleLaunchPreset = (preset: PresetScenario) => {
    setPlannerError(null);
    setResearchError(null);
    setGmailSendError(null);
    const uniqueTaskId = `${preset.ir.task_id}_${String(Date.now()).slice(-4)}`;
    const clonedPreset: PresetScenario = {
      ...preset,
      ir: {...preset.ir, task_id: uniqueTaskId},
    };
    const newTask = buildInitialTaskFromPreset(clonedPreset, operatingMode, targetOs, false);
    setTasks((prev) => [newTask, ...prev]);
    setActiveTaskId(newTask.taskId);

    if (!newTask.ir.approval.required) {
      appendAudit({
        actor: 'Policy Engine',
        action: newTask.ir.action,
        risk: newTask.ir.risk_level,
        decision: 'AUTO_PERMITTED',
        detail: `Auto-started LOW-risk preset "${newTask.title}" inside scoped sandbox.`,
      });
    }
  };

  const handleSubmitCustomPrompt = async (prompt: string) => {
    setPlannerError(null);
    setResearchError(null);
    setGmailSendError(null);
    setPlannerLoading(true);
    try {
      const response = await fetch('/api/plan-task', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt, operatingMode, targetOs}),
      });
      const data = await parseApiResponse<{
        title: string;
        summary?: string;
        selectedModel?: string;
        routingRationale?: string;
        liveResearchMode?: boolean;
        emailRecipient?: string;
        ir: TaskRun['ir'];
        steps?: Omit<TaskRun['steps'][number], 'status'>[];
        artifactPreview: TaskRun['artifactPreview'];
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate task plan.');
      }

      const taskId = data.ir?.task_id || `task_${String(Date.now()).slice(-5)}`;
      const needsApproval = Boolean(data.ir?.approval?.required);
      const wantsResearch =
        Boolean(data.liveResearchMode) ||
        /activepieces|n8n|openclaw|openclew|research|2026|excel|gmail|email/i.test(prompt);
      const extractedEmail =
        data.emailRecipient || prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || undefined;

      const newTask: TaskRun = {
        taskId,
        title: data.title,
        prompt,
        operatingMode,
        targetOs,
        status: needsApproval ? 'WAITING_APPROVAL' : 'RUNNING',
        selectedModel: data.selectedModel || 'gemini-4-hydrogen',
        routingRationale: data.routingRationale || 'Routed by Moe Model Router.',
        createdAt: nowTimestamp(),
        ir: data.ir,
        steps: (data.steps ?? []).map((s: Omit<TaskRun['steps'][number], 'status'>) => ({
          ...s,
          status: 'pending' as const,
        })),
        checkpoints: [],
        otelSpans: [
          {
            span_id: 'sp_req_live',
            stage: 'Request',
            component: 'Tauri IPC Bridge',
            duration_ms: 12,
            status: 'ok',
            attributes: `mode=${operatingMode} os=${targetOs}`,
          },
          {
            span_id: 'sp_plan_live',
            stage: 'Planner',
            component: 'Gemini 4 Hydrogen Planner',
            duration_ms: 680,
            status: 'ok',
            attributes: `action=${data.ir?.action} risk=${data.ir?.risk_level}`,
          },
        ],
        artifactPreview: data.artifactPreview,
        source: 'gemini',
        liveResearchMode: wantsResearch,
        emailRecipient: extractedEmail,
      };

      setTasks((prev) => [newTask, ...prev]);
      setActiveTaskId(newTask.taskId);

      if (!needsApproval) {
        appendAudit({
          actor: 'Policy Engine',
          action: newTask.ir.action,
          risk: newTask.ir.risk_level,
          decision: 'AUTO_PERMITTED',
          detail: `Auto-permitted LOW-risk Gemini plan "${newTask.title}".`,
        });
      }
    } catch (err: unknown) {
      setPlannerError(err instanceof Error ? err.message : 'Unable to reach Task Planner.');
    } finally {
      setPlannerLoading(false);
    }
  };

  const handleApproveTask = (taskId: string) => {
    if (killSwitchActive) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.taskId !== taskId) return t;
        appendAudit({
          actor: 'Human Operator',
          action: t.ir.action,
          risk: t.ir.risk_level,
          decision: 'APPROVED',
          detail: `Approved execution for ${t.taskId} with idempotency key ${t.ir.execution.idempotency_key}.`,
        });
        return {
          ...t,
          status: 'RUNNING',
          otelSpans: [
            ...t.otelSpans,
            {
              span_id: `sp_app_${Date.now()}`,
              stage: 'Validator',
              component: 'Human Approval Gate',
              duration_ms: 19,
              status: 'ok',
              attributes: `approved=true risk=${t.ir.risk_level}`,
            },
          ],
        };
      }),
    );
  };

  const handleRejectTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.taskId !== taskId) return t;
        appendAudit({
          actor: 'Human Operator',
          action: t.ir.action,
          risk: t.ir.risk_level,
          decision: 'DENIED',
          detail: `Operator rejected ${t.taskId} at Human Approval Gate.`,
        });
        return {
          ...t,
          status: 'CANCELLED',
          steps: t.steps.map((s) => (s.status === 'pending' ? {...s, status: 'cancelled'} : s)),
        };
      }),
    );
  };

  const handleSimulateCrash = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.taskId !== taskId || t.status !== 'RUNNING') return t;
        const crashIdx = t.steps.findIndex((s) => s.status === 'running' || s.status === 'pending');
        const crashedStep = t.steps[crashIdx];
        const walSeq = t.checkpoints.length + 1;

        const crashCp: CheckpointRecord | null = crashedStep
          ? {
              checkpoint_id: `cp_crash_${Date.now()}`,
              task_id: t.taskId,
              step_id: crashedStep.step_id,
              status: 'PAUSED_AT_CRASH',
              idempotency_key: crashedStep.idempotency_key,
              wal_seq: walSeq,
              timestamp: nowTimestamp(),
              note: crashedStep.external_side_effect
                ? 'Process interrupted during external step; idempotency reconciliation required before replay.'
                : 'Process interrupted; prior committed checkpoints remain intact in SQLite WAL.',
            }
          : null;

        return {
          ...t,
          status: 'PAUSED',
          crashedAtStepIndex: crashIdx,
          steps: t.steps.map((s, idx) => (idx === crashIdx ? {...s, status: 'paused'} : s)),
          checkpoints: crashCp ? [...t.checkpoints, crashCp] : t.checkpoints,
        };
      }),
    );
  };

  const handleRecoverTask = (taskId: string) => {
    if (killSwitchActive) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.taskId !== taskId || t.status !== 'PAUSED') return t;
        const pausedStep = t.steps.find((s) => s.status === 'paused');
        const walSeq = t.checkpoints.length + 1;

        appendAudit({
          actor: 'Recovery Manager',
          action: t.ir.action,
          risk: t.ir.risk_level,
          decision: 'RECOVERED',
          detail: `Replayed SQLite WAL for ${t.taskId}; skipped ${t.steps.filter((s) => s.status === 'completed').length} committed steps without duplicate execution.`,
        });

        const recoverCp: CheckpointRecord | null = pausedStep
          ? {
              checkpoint_id: `cp_rec_${Date.now()}`,
              task_id: t.taskId,
              step_id: pausedStep.step_id,
              status: 'RECOVERED',
              idempotency_key: pausedStep.idempotency_key,
              wal_seq: walSeq,
              timestamp: nowTimestamp(),
              note: `Resumed safely from ${pausedStep.step_id} using SQLite WAL replay.`,
            }
          : null;

        return {
          ...t,
          status: 'RUNNING',
          steps: t.steps.map((s) => (s.status === 'paused' ? {...s, status: 'pending'} : s)),
          checkpoints: recoverCp ? [...t.checkpoints, recoverCp] : t.checkpoints,
        };
      }),
    );
  };

  const handleRetryTask = (taskId: string) => {
    if (killSwitchActive) return;
    setResearchError(null);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.taskId !== taskId || t.status !== 'FAILED') return t;
        appendAudit({
          actor: 'Human Operator',
          action: t.ir.action,
          risk: t.ir.risk_level,
          decision: 'RECOVERED',
          detail: `Retrying failed task ${t.taskId} from checkpointed step.`,
        });
        return {
          ...t,
          status: 'RUNNING',
          steps: t.steps.map((s) => (s.status === 'paused' ? {...s, status: 'pending'} : s)),
        };
      }),
    );
  };

  const handleToggleKillSwitch = () => {
    const next = !killSwitchActive;
    setKillSwitchActive(next);
    if (next) {
      setTasks((prev) =>
        prev.map((t) =>
          t.status === 'RUNNING' || t.status === 'WAITING_APPROVAL'
            ? {
                ...t,
                status: 'CANCELLED',
                steps: t.steps.map((s) =>
                  s.status === 'running' || s.status === 'pending'
                    ? {...s, status: 'cancelled'}
                    : s,
                ),
              }
            : t,
        ),
      );
      appendAudit({
        actor: 'Security Kill Switch',
        action: 'engine.halt_all',
        risk: 'CRITICAL',
        decision: 'KILLED',
        detail: 'Emergency Kill Switch engaged. All active runners and pending approvals aborted.',
      });
    } else {
      appendAudit({
        actor: 'Human Operator',
        action: 'engine.restore',
        risk: 'MEDIUM',
        decision: 'APPROVED',
        detail: 'Emergency Kill Switch released. Execution Engine restored to ready state.',
      });
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090D16] text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        operatingMode={operatingMode}
        onChangeMode={setOperatingMode}
        usedRamMb={usedRamMb}
        killSwitchActive={killSwitchActive}
        waitingApprovalCount={waitingApprovalCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          onNewTask={() => {
            setActiveSection('workspace');
            setPlannerError(null);
            setResearchError(null);
            setGmailSendError(null);
          }}
          killSwitchActive={killSwitchActive}
          onToggleKillSwitch={handleToggleKillSwitch}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {activeSection === 'workspace' && (
            <TaskWorkspace
              activeTask={activeTask}
              operatingMode={operatingMode}
              targetOs={targetOs}
              onChangeTargetOs={setTargetOs}
              onLaunchPreset={handleLaunchPreset}
              onSubmitCustomPrompt={handleSubmitCustomPrompt}
              onApproveTask={handleApproveTask}
              onRejectTask={handleRejectTask}
              onSimulateCrash={handleSimulateCrash}
              onRecoverTask={handleRecoverTask}
              onRetryTask={handleRetryTask}
              onOpenMonitor={() => setActiveSection('monitor')}
              plannerLoading={plannerLoading}
              plannerError={plannerError}
              researchLoading={researchLoading}
              researchError={researchError}
              killSwitchActive={killSwitchActive}
              googleUserEmail={googleUserEmail}
              googleAuthLoading={googleAuthLoading}
              googleAuthError={googleAuthError}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleLogout={handleGoogleLogout}
              onSendGmailReport={handleSendGmailReport}
              gmailSending={gmailSending}
              gmailSendError={gmailSendError}
            />
          )}

          {activeSection === 'agents' && <AgentActivityView activeTask={activeTask} />}

          {activeSection === 'monitor' && (
            <ExecutionMonitorView
              tasks={tasks}
              activeTask={activeTask}
              onSelectTask={(id) => setActiveTaskId(id)}
              onSimulateCrash={handleSimulateCrash}
              onRecoverTask={handleRecoverTask}
            />
          )}

          {activeSection === 'connectors' && (
            <ConnectorsMcpView
              connectors={connectors}
              onToggleConnector={(id) =>
                setConnectors((prev) =>
                  prev.map((c) => (c.id === id ? {...c, enabled: !c.enabled} : c)),
                )
              }
            />
          )}

          {activeSection === 'permissions' && (
            <PermissionsVaultView
              killSwitchActive={killSwitchActive}
              onToggleKillSwitch={handleToggleKillSwitch}
              auditLog={auditLog}
            />
          )}

          {activeSection === 'models' && (
            <ModelsMemoryView
              modelSlots={modelSlots}
              onToggleModelLoad={(id) =>
                setModelSlots((prev) =>
                  prev.map((m) => (m.id === id ? {...m, loaded: !m.loaded} : m)),
                )
              }
              memoryLayers={memoryLayers}
              onPurgeMemoryLayer={(id) =>
                setMemoryLayers((prev) =>
                  prev.map((l) =>
                    l.id === id ? {...l, entriesCount: 0, sizeMb: 0, sampleItems: []} : l,
                  ),
                )
              }
              baseRuntimeRamMb={baseRuntimeRamMb}
            />
          )}

          {activeSection === 'blueprint' && <BlueprintInspectorView />}
        </main>
      </div>
      <OfflineIndicator />
    </div>
  );
}
