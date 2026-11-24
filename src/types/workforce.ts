export type OperatingMode = 'local' | 'hybrid' | 'cloud';
export type TargetOS = 'windows' | 'linux' | 'macos';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type LifecycleStatus =
  | 'RECEIVED'
  | 'VALIDATING'
  | 'PLANNING'
  | 'WAITING_APPROVAL'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type NavSection =
  | 'workspace'
  | 'agents'
  | 'monitor'
  | 'connectors'
  | 'permissions'
  | 'models'
  | 'blueprint';

export interface UniversalTaskIR {
  schema_version: string;
  task_id: string;
  action: string;
  capability: string;
  target: {
    resources: string[];
    output_path: string;
  };
  execution: {
    mode: string;
    retry_limit: number;
    timeout_seconds: number;
    idempotency_key: string;
  };
  permissions: {
    filesystem: string[];
    network: string[];
    connectors: string[];
  };
  risk_level: RiskLevel;
  approval: {
    required: boolean;
    reason: string;
  };
}

export interface ExecutionStep {
  step_id: string;
  agent: string;
  action_label: string;
  semantic_milestone: string;
  capability: string;
  adapter_resolved: string;
  estimated_ms: number;
  idempotency_key: string;
  checkpoint_safe: boolean;
  external_side_effect: boolean;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'skipped' | 'cancelled';
  duration_ms?: number;
}

export interface CheckpointRecord {
  checkpoint_id: string;
  task_id: string;
  step_id: string;
  status: 'COMMITTED' | 'PAUSED_AT_CRASH' | 'RECOVERED' | 'ROLLED_BACK';
  idempotency_key: string;
  wal_seq: number;
  timestamp: string;
  note: string;
}

export interface TraceSpan {
  span_id: string;
  stage: 'Request' | 'Planner' | 'Agent' | 'IR' | 'Validator' | 'Connector' | 'Execution Result';
  component: string;
  duration_ms: number;
  status: 'ok' | 'waiting' | 'error';
  attributes: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ComparisonTableRow {
  criterion_en: string;
  criterion_mm: string;
  activepieces: string;
  n8n: string;
  openclaw: string;
  notes_mm: string;
}

export interface BilingualResearchReport {
  reportTitleEn: string;
  reportTitleMm: string;
  executiveSummaryEn: string;
  executiveSummaryMm: string;
  tableRows: ComparisonTableRow[];
  detailedSections: {
    headingEn: string;
    headingMm: string;
    bodyEn: string;
    bodyMm: string;
  }[];
  sources: GroundingSource[];
  searchProvider?: string;
  generatedAt: string;
  excelFilename: string;
}

export interface ArtifactPreview {
  kind: 'spreadsheet' | 'document' | 'presentation' | 'report';
  filename: string;
  headline: string;
  summaryMetrics: {label: string; value: string}[];
  sections: {heading: string; detail: string}[];
  researchReport?: BilingualResearchReport;
}

export interface TaskRun {
  taskId: string;
  title: string;
  prompt: string;
  operatingMode: OperatingMode;
  targetOs: TargetOS;
  status: LifecycleStatus;
  selectedModel: string;
  routingRationale: string;
  createdAt: string;
  ir: UniversalTaskIR;
  steps: ExecutionStep[];
  checkpoints: CheckpointRecord[];
  otelSpans: TraceSpan[];
  artifactPreview: ArtifactPreview;
  crashedAtStepIndex?: number;
  source: 'preset' | 'gemini';
  liveResearchMode?: boolean;
  emailRecipient?: string;
  gmailSentMessageId?: string;
}

export interface PresetScenario {
  id: string;
  title: string;
  category: string;
  prompt: string;
  recommendedMode: OperatingMode;
  recommendedOs: TargetOS;
  selectedModel: string;
  routingRationale: string;
  ir: UniversalTaskIR;
  steps: Omit<ExecutionStep, 'status'>[];
  artifactPreview: ArtifactPreview;
  liveResearchMode?: boolean;
  emailRecipient?: string;
}

export interface ConnectorDef {
  id: string;
  version: string;
  name: string;
  type: 'Native' | 'Office' | 'MCP 2026' | 'WASM Sandbox' | 'A2A 1.0';
  category: string;
  supportedActions: string[];
  requiredPermissions: string[];
  platforms: TargetOS[];
  license: string;
  enabled: boolean;
  sandboxLimits?: {
    memoryMb: number;
    fuelLimit: string;
    networkRestricted: boolean;
  };
  description: string;
}

export interface ModelSlot {
  id: string;
  name: string;
  modality: 'LLM' | 'STT' | 'TTS' | 'Vision' | 'Embeddings';
  runtime: 'ONNX Runtime' | 'llama.cpp' | 'Cloud API' | 'Moe TTS';
  ramMb: number;
  loaded: boolean;
  quantization: string;
  purpose: string;
}

export interface MemoryLayer {
  id: string;
  name: string;
  storageBackend: string;
  entriesCount: number;
  sizeMb: number;
  retentionRule: string;
  sensitive: boolean;
  sampleItems: string[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  risk: RiskLevel;
  decision: 'APPROVED' | 'DENIED' | 'AUTO_PERMITTED' | 'KILLED' | 'RECOVERED';
  detail: string;
}
