import { ciBounds, jsdLabel } from '../../lib/format'
import { SIMILARITY_LABEL, similarityOf } from '../../lib/explain'

/**
 * 总差异度数轴：把 5 类题目的差异平均成一个分数，越小两边越像。
 * 三段配色 = 三个判定区间：绿「很像」/ 黄「说不准」/ 红「很不像」
 */
export function JsdScale({ aggregate, matchThreshold, mismatchThreshold }: {
  aggregate: number | null | undefined
  matchThreshold: number
  mismatchThreshold: number
}) {
  const max = Math.max(mismatchThreshold * 1.5, (aggregate ?? 0) * 1.2, 0.05)
  const width = 720
  const height = 96
  const trackY = 44
  const trackH = 12
  const x = (value: number) => (value / max) * width
  const similarity = similarityOf(aggregate, matchThreshold, mismatchThreshold)
  const zoneColor = similarity === 'alike' ? 'text-success-700' : similarity === 'different' ? 'text-danger-700' : 'text-amber-600'

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-muted">总差异度</span>
          <strong className="ml-2 text-2xl tracking-tight text-slate-900">{aggregate === null || aggregate === undefined ? '不计算' : jsdLabel(aggregate)}</strong>
          {similarity && <span className={`ml-2 text-sm font-bold ${zoneColor}`}>{SIMILARITY_LABEL[similarity]}</span>}
          {(aggregate === null || aggregate === undefined) && <span className="ml-2 text-xs text-faint">有题目证据不足时不硬算总分</span>}
        </div>
        <div className="flex gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-success-600" />很像 ≤ {matchThreshold}</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-amber-500" />说不准</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-danger-700" />很不像 ≥ {mismatchThreshold}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`总差异度 ${jsdLabel(aggregate)}，很像线 ${matchThreshold}，很不像线 ${mismatchThreshold}`}>
        <rect x={0} y={trackY} width={x(matchThreshold)} height={trackH} rx={6} fill="#14895f" opacity={0.18} />
        <rect x={x(matchThreshold)} y={trackY} width={x(mismatchThreshold) - x(matchThreshold)} height={trackH} fill="#d97706" opacity={0.16} />
        <rect x={x(mismatchThreshold)} y={trackY} width={width - x(mismatchThreshold)} height={trackH} rx={6} fill="#b42318" opacity={0.14} />
        {[matchThreshold, mismatchThreshold].map(threshold => (
          <g key={threshold}>
            <line x1={x(threshold)} y1={trackY - 6} x2={x(threshold)} y2={trackY + trackH + 6} stroke="#15213a" strokeWidth={1.5} strokeDasharray="3 3" />
            <text x={x(threshold)} y={trackY + trackH + 22} textAnchor="middle" fontSize={10} fill="#6e7d94">{threshold}</text>
          </g>
        ))}
        {aggregate !== null && aggregate !== undefined && (
          <g>
            <line x1={x(aggregate)} y1={trackY - 4} x2={x(aggregate)} y2={trackY + trackH + 4} stroke="#15213a" strokeWidth={2.5} />
            <circle cx={x(aggregate)} cy={trackY - 12} r={5} fill="#15213a" />
            <text x={x(aggregate)} y={trackY - 22} textAnchor="middle" fontSize={12} fontWeight={700} fill="#15213a">本次 {jsdLabel(aggregate)}</text>
          </g>
        )}
        <text x={0} y={trackY + trackH + 22} textAnchor="start" fontSize={10} fill="#8a96a9">0 完全一样</text>
        <text x={width} y={trackY + trackH + 22} textAnchor="end" fontSize={10} fill="#8a96a9">{max.toFixed(2)} 差别很大</text>
      </svg>
    </div>
  )
}

/** 单 cell 的 JSD 条形 + bootstrap 95% CI  whisker，阈值用虚线标出 */
export function CellJsdBar({ jsd, ci, matchThreshold, mismatchThreshold }: {
  jsd?: number
  ci?: { lower: number; upper: number } | [number, number] | null
  matchThreshold: number
  mismatchThreshold: number
}) {
  if (jsd === undefined) return null
  const bounds = ciBounds(ci)
  const max = Math.max(mismatchThreshold * 1.4, bounds?.[1] ?? 0, jsd) * 1.08
  const pct = (value: number) => `${Math.min(100, (value / max) * 100)}%`
  const color = jsd <= matchThreshold ? '#14895f' : jsd >= mismatchThreshold ? '#b42318' : '#d97706'
  return (
    <div className="relative h-4 w-full overflow-visible rounded-full bg-slate-100" role="img" aria-label={`cell JSD ${jsd.toFixed(4)}，95% CI [${bounds?.[0].toFixed(4) ?? '—'}, ${bounds?.[1].toFixed(4) ?? '—'}]`}>
      <div className="absolute top-0 left-0 h-full rounded-l-full" style={{ width: pct(jsd), background: color, opacity: 0.85, borderRadius: jsd >= max * 0.98 ? 999 : undefined }} />
      {bounds && (
        <>
          <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-slate-800" style={{ left: pct(bounds[0]), width: `calc(${pct(bounds[1])} - ${pct(bounds[0])})` }} />
          <div className="absolute top-0 h-full w-0.5 bg-slate-800" style={{ left: pct(bounds[0]) }} />
          <div className="absolute top-0 h-full w-0.5 bg-slate-800" style={{ left: pct(bounds[1]) }} />
        </>
      )}
      {[matchThreshold, mismatchThreshold].map(threshold => (
        <div key={threshold} className="absolute -top-0.5 h-5 border-l border-dashed border-slate-500" style={{ left: pct(threshold) }} />
      ))}
    </div>
  )
}
