export function dateLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function fullDateLabel(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value))
}

export function percent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function jsdLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toFixed(4)
}

/** 后端 ci_95 是 {lower, upper} 对象；兼容元组形式 */
export function ciBounds(ci: { lower: number; upper: number } | [number, number] | null | undefined): [number, number] | null {
  if (!ci) return null
  if (Array.isArray(ci)) return ci
  return [ci.lower, ci.upper]
}

const LEGACY_REASON_LABELS: Record<string, string> = {
  reference_baseline_is_incomplete: '参考基线不完整，缺少部分 Probe Cell 的有效样本。',
  reference_baseline_has_no_valid_cells: '参考基线没有任何有效样本，不能用于审计。',
}

/** 旧版本运行的 reasons 是纯字符串，新版本是 {code, message} 对象 */
export function reasonText(reason: import('./types').QualityReasonLike) {
  if (typeof reason !== 'string') return reason.message
  return LEGACY_REASON_LABELS[reason] ?? reason
}

export function reasonKey(reason: import('./types').QualityReasonLike) {
  return typeof reason === 'string' ? reason : reason.code
}

export function durationLabel(start?: string, end?: string) {
  if (!start) return '—'
  const ms = new Date(end ?? new Date().toISOString()).getTime() - new Date(start).getTime()
  if (ms < 0) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} 分 ${seconds % 60} 秒`
}

/** 从检验请求里提取「哪个站点、哪个模型」，用于列表和报告页区分 */
export function auditTarget(run: { kind: string; request?: { suspect_base_url?: string; suspect_model_id?: string | null; label?: string | null } }): { label: string | null; host: string | null; model: string | null } {
  if (run.kind !== 'audit' || !run.request) return { label: null, host: null, model: null }
  let host: string | null = null
  try {
    host = run.request.suspect_base_url ? new URL(run.request.suspect_base_url).host : null
  } catch {
    host = run.request.suspect_base_url ?? null
  }
  return { label: run.request.label ?? null, host, model: run.request.suspect_model_id ?? null }
}
