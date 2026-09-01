export type Protocol = 'openai_responses' | 'openai_chat_completions' | 'anthropic_messages'

export type Model = {
  id: string
  provider: string
  display_name: string
  api_model_id: string
  protocols: Protocol[]
}

export type Gateway = {
  id: string
  name: string
  base_url: string
  routes: Record<string, { path: string }>
  created_at?: string
}

export type ProfileState = 'calibrated' | 'baseline_ready' | 'failed'

export type BaselineQuality = {
  ready: boolean
  minimum_valid_per_cell?: number
  minimum_valid_rate?: number
  observed_valid_rate?: number
  missing_cells?: string[]
  reasons: QualityReasonLike[]
  recommended_actions?: string[]
}

export type QualityReason = {
  code: string
  message: string
  cells?: string[]
}

/** 旧版本运行写入的 reasons 可能是纯字符串 */
export type QualityReasonLike = QualityReason | string

export type Profile = {
  id: string
  model_id: string
  provider: string
  api_model_id: string
  protocol: Protocol
  state: ProfileState
  sampling: { sample_count?: number; temperature?: number; top_p?: number; max_output_tokens?: number }
  capabilities: { accepted_parameters?: string[]; supported_features?: string[]; probe_revision?: string }
  baseline: Record<string, Record<string, number>>
  threshold: { match_threshold: number; mismatch_threshold: number }
  quality: BaselineQuality
  updated_at?: string
  created_at?: string
}

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type RunKind = 'audit' | 'enrollment'

export type AuditRequestRecord = {
  suspect_base_url?: string
  suspect_model_id?: string | null
  suspect_path?: string | null
  label?: string | null
  sample_count?: number
}

export type Run = {
  id: string
  kind: RunKind
  profile_id: string
  status: RunStatus
  request?: AuditRequestRecord & Record<string, unknown>
  result?: {
    verdict?: Verdict
    aggregate_jsd?: number | null
    sample_count?: number
    profile_id?: string
    profile_state?: ProfileState
  }
  error?: string
  created_at: string
  started_at?: string
  finished_at?: string
}

export type Verdict =
  | 'CONSISTENT_WITH_REFERENCE'
  | 'INCOMPATIBLE_WITH_REFERENCE'
  | 'MIXED_OR_DYNAMIC_ROUTING'
  | 'TRANSPORT_OR_PARAMETER_ALTERED'
  | 'INCONCLUSIVE'

export type DecisionStatus = Verdict | 'BASELINE_READY' | 'BASELINE_REJECTED' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export type Decision = {
  status: DecisionStatus
  title: string
  summary: string
  reasons: QualityReasonLike[]
  recommended_actions: string[]
}

export type NormalizationFailure = { code: string; label: string; count: number }

export type TransportFailure = { category: string; http_status: number | null; message: string; count: number }

export type ResponseExample = {
  prompt: string
  response_preview: string
  outcome: 'valid' | 'transport_failure' | 'invalid_format'
  reason: string | null
}

export type CellAnalysis = {
  cell_id: string
  category: string
  attempted: number
  transport_success: number
  transport_failures: number
  valid: number
  invalid: number
  valid_rate: number
  average_latency_ms: number | null
  answer_distribution: Record<string, number>
  normalization_failures: NormalizationFailure[]
  transport_failure_summary: TransportFailure[]
  response_examples: ResponseExample[]
}

export type Evidence = {
  attempted: number
  transport_success: number
  transport_failures: number
  valid: number
  invalid: number
  valid_rate: number
  average_latency_ms: number | null
  cells: CellAnalysis[]
  historical_detail_notice: string | null
}

export type ConfidenceInterval = { lower: number; upper: number }

export type CellComparison = {
  cell_id: string
  status: 'comparable' | 'reference_baseline_missing' | 'insufficient_suspect_evidence'
  reference_distribution: Record<string, number>
  suspect_distribution: Record<string, number>
  jsd?: number
  ci_95?: ConfidenceInterval | [number, number] | null
  valid_samples: number
  required_valid_samples: number
}

export type Comparison = {
  required_valid_samples_per_cell: number
  comparable_cells: number
  total_cells: number
  cells: CellComparison[]
}

export type Report = {
  run: Run
  decision: Decision
  evidence: Evidence
  comparison: Comparison | null
  quality: BaselineQuality | null
  result: {
    verdict?: Verdict
    aggregate_jsd?: number | null
    threshold?: { match_threshold: number; mismatch_threshold: number }
    sample_count?: number
    limitations?: string[]
    reference_source_type?: string
  }
  profile: Profile | null
}

export const PROTOCOL_LABELS: Record<Protocol, string> = {
  openai_responses: 'Responses',
  openai_chat_completions: 'Chat Completions',
  anthropic_messages: 'Messages',
}

export const PROTOCOL_PATHS: Record<Protocol, string> = {
  openai_responses: '/v1/responses',
  openai_chat_completions: '/v1/chat/completions',
  anthropic_messages: '/v1/messages',
}

export const CELL_LABELS: Record<string, string> = {
  number_1_10_zh: '随机数 1-10（中）',
  number_1_10_en: '随机数 1-10（英）',
  coin: '抛硬币',
  color: '随机颜色',
  letter: '随机字母',
}

/** 检查项数量，与后端 probes.BATTERY 保持一致（由 CELL_LABELS 派生） */
export const BATTERY_CELL_COUNT = Object.keys(CELL_LABELS).length
