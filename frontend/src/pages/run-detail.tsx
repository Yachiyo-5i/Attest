import { CheckCircle2, CircleAlert, ListChecks, LoaderCircle, TimerReset } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CellJsdBar, JsdScale } from '../components/charts/jsd-scale'
import { DistributionCompare } from '../components/charts/distribution-compare'
import { PageContent } from '../components/layout/app-shell'
import { RunActions } from '../components/run-actions'
import { RunSymbol } from '../components/run-table'
import { EmptyState, SectionHeader, StatusPill, Surface } from '../components/ui/primitives'
import { useReport } from '../hooks/queries'
import { cn } from '../lib/cn'
import { auditTarget, ciBounds, durationLabel, fullDateLabel, jsdLabel, percent, reasonKey, reasonText } from '../lib/format'
import { auditNarrative, CELL_QUESTIONS, differenceSentence, SIMILARITY_LABEL, similarityOf, stabilityOf } from '../lib/explain'
import { BATTERY_CELL_COUNT, CELL_LABELS, PROTOCOL_LABELS, type CellAnalysis, type CellComparison, type Report } from '../lib/types'
import { verdictOf } from '../lib/verdict'


function cellLabel(cellId: string) {
  return CELL_LABELS[cellId] ?? cellId
}

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const { data: report, isPending, isError } = useReport(runId)

  if (isPending) {
    return (
      <PageContent title="检验报告">
        <div className="grid min-h-60 place-items-center gap-2 text-sm text-muted">
          <LoaderCircle size={22} className="animate-spin text-accent-600" />
          正在载入报告
        </div>
      </PageContent>
    )
  }
  if (isError || !report) {
    return (
      <PageContent breadcrumb={[{ label: '检验记录', to: '/runs' }, { label: '检验报告' }]}>
        <Surface>
          <EmptyState icon={CircleAlert} title="找不到这条记录" description="记录可能已被清理，或链接有误。" action={<Link to="/runs" className="text-xs font-bold text-accent-600">查看全部记录</Link>} />
        </Surface>
      </PageContent>
    )
  }

  const { run, evidence, comparison, quality, result, profile } = report
  const active = run.status === 'queued' || run.status === 'running'
  const isAudit = run.kind === 'audit'
  const sampleCount = result.sample_count ?? Number(run.request?.sample_count ?? 0)
  const totalPlanned = sampleCount * BATTERY_CELL_COUNT
  const target = auditTarget(run)
  const pageTitle = isAudit ? (target.label ?? target.host ?? '真实性检验') : '基线采集'
  const pageSubtitle = isAudit
    ? [target.label ? target.host : null, target.model ?? profile?.api_model_id, '基准：' + run.profile_id.replace('.reference-gateway.v1', '')].filter(Boolean).join(' · ')
    : run.profile_id.replace('.reference-gateway.v1', '')

  return (
    <PageContent breadcrumb={[{ label: '检验记录', to: '/runs' }, { label: isAudit ? '真实性检验报告' : '基线采集报告' }]}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <RunSymbol kind={run.kind} className="size-10 text-sm" />
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-slate-900">
            {pageTitle}
          </h1>
          <p className="m-0 mt-1 truncate text-xs text-faint">{pageSubtitle}</p>
        </div>
        <span className="ml-auto flex items-center gap-2">
          <StatusPill status={run.status} />
          <RunActions run={run} onDeleted={() => navigate('/runs')} />
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)] items-start gap-4 max-lg:grid-cols-1">
        <div className="grid gap-4">
          {active ? (
            <ProgressSection report={report} totalPlanned={totalPlanned} />
          ) : (
            <>
              <VerdictBanner report={report} />
              {isAudit && result.threshold && (
                <Surface>
                  <SectionHeader eyebrow="OVERALL SCORE" title="总差异度" description="把 5 类题目的差异平均成一个分数：0 表示两边完全一样，越大越不像。分数落在绿区算「很像」，红区算「很不像」，中间是说不准。有题目证据不足时不硬算总分。" />
                  <JsdScale aggregate={result.aggregate_jsd} matchThreshold={result.threshold.match_threshold} mismatchThreshold={result.threshold.mismatch_threshold} />
                </Surface>
              )}
              {isAudit && comparison ? (
                <AuditCells report={report} />
              ) : (
                <EnrollmentCells report={report} />
              )}
              <FailureDiagnostics evidence={report.evidence} />
            </>
          )}
        </div>
        <div className="grid gap-4 max-lg:order-first">
          <RunMetaCard report={report} totalPlanned={totalPlanned} />
          {profile && <ProfileCard report={report} />}
          {!active && quality && !quality.ready && <QualityCard report={report} />}
        </div>
      </div>
    </PageContent>
  )
}

function VerdictBanner({ report }: { report: Report }) {
  const { decision, result, comparison, run } = report
  const config = verdictOf(decision.status)
  const reasons = decision.reasons ?? []
  const actions = decision.recommended_actions ?? []
  const Icon = config.icon
  const threshold = result.threshold
  const narrative = run.kind === 'audit'
    ? auditNarrative(decision.status, comparison, CELL_LABELS, threshold?.match_threshold ?? 0.1, threshold?.mismatch_threshold ?? 0.22)
    : null
  return (
    <section className={cn('rounded-xl border p-6', config.banner)}>
      <div className="flex items-start gap-4">
        <span className={cn('grid size-11 flex-none place-items-center rounded-xl', config.iconColor)}>
          <Icon size={22} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-extrabold tracking-[0.12em] text-slate-500 uppercase">{config.label}</p>
          <h2 className="m-0 mt-1 text-xl font-semibold text-slate-900">{narrative?.headline ?? decision.title}</h2>
          <p className="m-0 mt-2 text-sm leading-relaxed text-slate-600">{narrative?.meaning ?? decision.summary}</p>
          {narrative?.source && (
            <p className="m-0 mt-2 text-sm font-semibold text-slate-700">{narrative.source}</p>
          )}
          {narrative?.confidence && (
            <p className="m-0 mt-1.5 text-xs text-slate-500">结论依据：{narrative.confidence}</p>
          )}
          {reasons.length > 0 && (
            <ul className="m-0 mt-3 grid list-none gap-1.5 p-0">
              {reasons.map(reason => (
                <li key={reasonKey(reason)} className="flex items-start gap-2 text-[13px] text-slate-600">
                  <CircleAlert size={14} className="mt-0.5 flex-none text-slate-500" />
                  {reasonText(reason)}
                </li>
              ))}
            </ul>
          )}
          {actions.length > 0 && (
            <div className="mt-3 rounded-lg bg-white/70 p-3">
              <p className="m-0 mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-slate-500 uppercase"><ListChecks size={13} />建议动作</p>
              <ul className="m-0 grid list-disc gap-1 pl-5 text-[13px] text-slate-600">
                {actions.map(action => <li key={action}>{action}</li>)}
              </ul>
            </div>
          )}
          {(result.limitations?.length ?? 0) > 0 && (
            <p className="m-0 mt-3 text-[11px] leading-relaxed text-slate-500">
              结论边界：{result.limitations!.join(' ')}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function ProgressSection({ report, totalPlanned }: { report: Report; totalPlanned: number }) {
  const { evidence, run } = report
  const done = evidence.attempted
  const pct = totalPlanned ? Math.min(100, Math.round((done / totalPlanned) * 100)) : 0
  return (
    <Surface>
      <SectionHeader
        eyebrow="LIVE PROGRESS"
        title={run.status === 'queued' ? '任务排队中' : '正在采集样本'}
        description={run.status === 'queued' ? '任务已创建，即将开始采集。' : '正在逐条发出请求并收集回答，页面会自动刷新进度。'}
      />
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <strong className="text-slate-800">{done} / {totalPlanned || '—'} 次请求</strong>
        <span className="text-xs text-faint">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-accent-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <div className="rounded-lg bg-slate-50 p-3"><span className="block text-[11px] text-faint">有效样本率</span><strong className="text-lg text-slate-800">{percent(evidence.valid_rate)}</strong></div>
        <div className="rounded-lg bg-slate-50 p-3"><span className="block text-[11px] text-faint">平均延迟</span><strong className="text-lg text-slate-800">{evidence.average_latency_ms === null ? '—' : `${evidence.average_latency_ms} ms`}</strong></div>
        <div className="rounded-lg bg-slate-50 p-3"><span className="block text-[11px] text-faint">传输失败</span><strong className="text-lg text-slate-800">{evidence.transport_failures}</strong></div>
      </div>
      <div className="mt-5 grid gap-2.5">
        {evidence.cells.map(cell => {
          const planned = totalPlanned ? totalPlanned / BATTERY_CELL_COUNT : 0
          const cellPct = planned ? Math.min(100, Math.round((cell.attempted / planned) * 100)) : 0
          return (
            <div key={cell.cell_id} className="grid grid-cols-[130px_minmax(0,1fr)_74px] items-center gap-3">
              <span className="truncate text-xs font-semibold text-slate-600">{cellLabel(cell.cell_id)}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-accent-400 transition-[width] duration-500" style={{ width: `${cellPct}%` }} />
              </div>
              <span className="text-right text-[11px] text-faint">{cell.attempted}/{planned || '—'}</span>
            </div>
          )
        })}
      </div>
    </Surface>
  )
}

function AuditCells({ report }: { report: Report }) {
  const { comparison, evidence, result } = report
  if (!comparison) return null
  const evidenceByCell = new Map(evidence.cells.map(cell => [cell.cell_id, cell]))
  const threshold = result.threshold
  return (
    <Surface>
      <SectionHeader
        eyebrow="QUESTION BY QUESTION"
        title="逐题对比：两边分别怎么回答"
        description={`同一批「随便选一个」的问题，基准和被测站点各自的回答分布。柱形差得越多，差异越大。${comparison.total_cells} 道题中 ${comparison.comparable_cells} 道证据充分可以比较。`}
      />
      <div className="grid gap-5">
        {comparison.cells.map(cell => (
          <CellCard
            key={cell.cell_id}
            cell={cell}
            evidence={evidenceByCell.get(cell.cell_id)}
            matchThreshold={threshold?.match_threshold ?? 0}
            mismatchThreshold={threshold?.mismatch_threshold ?? 1}
          />
        ))}
      </div>
    </Surface>
  )
}

function CellCard({ cell, evidence, matchThreshold, mismatchThreshold }: {
  cell: CellComparison
  evidence?: CellAnalysis
  matchThreshold: number
  mismatchThreshold: number
}) {
  const comparable = cell.status === 'comparable'
  const ci = ciBounds(cell.ci_95)
  const similarity = similarityOf(cell.jsd, matchThreshold, mismatchThreshold)
  const stability = stabilityOf(cell.ci_95, matchThreshold, mismatchThreshold)
  const sentence = comparable ? differenceSentence(cell) : null
  const badgeTone = similarity === 'alike'
    ? 'bg-success-100 text-success-700'
    : similarity === 'different'
      ? 'bg-danger-100 text-danger-700'
      : 'bg-amber-100 text-amber-700'
  return (
    <article className="rounded-xl border border-line-soft p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <strong className="text-sm text-slate-800">{cellLabel(cell.cell_id)}</strong>
        {comparable && similarity ? (
          <span className={cn('inline-flex w-max items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold', badgeTone)}>
            {similarity === 'alike' ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}
            {SIMILARITY_LABEL[similarity]}
          </span>
        ) : (
          <span className="inline-flex w-max items-center gap-1.5 rounded-md bg-warning-100 px-2 py-1 text-[11px] font-bold text-warning-700">
            <CircleAlert size={13} />
            没法比
          </span>
        )}
        <span className="ml-auto text-[11px] text-faint">
          有效回答 {cell.valid_samples} 条
          {evidence?.average_latency_ms != null && ` · 平均响应 ${(evidence.average_latency_ms / 1000).toFixed(1)}s`}
        </span>
      </div>
      <p className="m-0 mb-3 text-[11px] text-faint">
        这道题问了模型：{CELL_QUESTIONS[cell.cell_id] ?? '随口给一个答案'}
      </p>
      <DistributionCompare reference={cell.reference_distribution} suspect={cell.suspect_distribution} />
      {sentence && (
        <p className="m-0 mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">{sentence}</p>
      )}
      {comparable ? (
        <div className="mt-3 grid gap-1.5">
          <div className="flex justify-between text-[11px] text-muted">
            <span>差异度 {jsdLabel(cell.jsd)}</span>
            <span>≤{matchThreshold} 很像 · ≥{mismatchThreshold} 很不像</span>
          </div>
          <CellJsdBar jsd={cell.jsd} ci={cell.ci_95} matchThreshold={matchThreshold} mismatchThreshold={mismatchThreshold} />
          <div className="flex justify-between text-[10px] text-faint">
            <span>← 两边完全一样</span>
            <span>完全不一样 →</span>
          </div>
          {stability === 'shaky' && (
            <p className="m-0 mt-1 flex items-start gap-1.5 text-[11px] text-amber-700">
              <CircleAlert size={12} className="mt-0.5 flex-none" />
              这一题样本偏少，差异度数值下次测可能会明显变化，别单独拿它下结论。
            </p>
          )}
          {ci && (
            <p className="m-0 text-[10px] text-faint">技术细节：JSD {jsdLabel(cell.jsd)}，95% 置信区间 [{ci[0].toFixed(4)}, {ci[1].toFixed(4)}]</p>
          )}
        </div>
      ) : (
        <p className="m-0 mt-3 text-xs leading-relaxed text-warning-700">
          {cell.status === 'reference_baseline_missing'
            ? '基准里缺少这一题的数据，没法比较。重新采集基线即可解决。'
            : `这一题只收到 ${cell.valid_samples} 条有效回答（至少需要 ${cell.required_valid_samples} 条），不参与总差异度。请求超时或回答格式异常都可能导致样本不够。`}
        </p>
      )}
      {evidence && <CellEvidenceNotes evidence={evidence} />}
    </article>
  )
}

function EnrollmentCells({ report }: { report: Report }) {
  const { evidence, run } = report
  // 历史 audit 运行没有 comparison 字段时，这里展示的是待测端单侧分布
  const isAudit = run.kind === 'audit'
  return (
    <Surface>
      <SectionHeader
        eyebrow={isAudit ? 'SUSPECT DISTRIBUTION' : 'REFERENCE DISTRIBUTION'}
        title={isAudit ? '被测站点的回答分布' : '基准的回答分布'}
        description={isAudit ? '这是一条早期版本的记录，仅展示被测站点的回答分布。' : '这些分布将作为今后检验的对照基准：检验就是看被测站点的回答习惯和这里像不像。'}
      />
      <div className="grid gap-5">
        {evidence.cells.map(cell => (
          <article key={cell.cell_id} className="rounded-xl border border-line-soft p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <strong className="text-sm text-slate-800">{cellLabel(cell.cell_id)}</strong>
              <span className="ml-auto text-[11px] text-faint">
                有效 {cell.valid}/{cell.attempted}（{percent(cell.valid_rate)}）
                {cell.average_latency_ms != null && ` · 均延迟 ${cell.average_latency_ms}ms`}
              </span>
            </div>
            <DistributionCompare reference={cell.answer_distribution} />
            <CellEvidenceNotes evidence={cell} />
          </article>
        ))}
      </div>
    </Surface>
  )
}

function CellEvidenceNotes({ evidence }: { evidence: CellAnalysis }) {
  const hasFailures = evidence.transport_failure_summary.length > 0 || evidence.normalization_failures.length > 0
  if (!hasFailures && evidence.response_examples.length === 0) return null
  return (
    <details className="mt-3 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-muted open:pb-3.5">
      <summary className="cursor-pointer font-semibold text-slate-600">
        失败分类与响应摘要
        {hasFailures && <span className="ml-2 text-warning-700">{evidence.transport_failures + evidence.invalid} 条异常</span>}
      </summary>
      <div className="mt-2.5 grid gap-3">
        {evidence.transport_failure_summary.map(item => (
          <p key={`${item.category}-${item.http_status}-${item.message}`} className="m-0">
            <span className="font-semibold text-slate-700">传输失败 · {item.category}{item.http_status ? ` (HTTP ${item.http_status})` : ''} × {item.count}</span>
            <br /><span className="font-mono text-[11px] break-all">{item.message}</span>
          </p>
        ))}
        {evidence.normalization_failures.map(item => (
          <p key={item.code} className="m-0">
            <span className="font-semibold text-slate-700">格式失败 · {item.label} × {item.count}</span>
          </p>
        ))}
        {evidence.response_examples.map((example, index) => (
          <div key={index} className="rounded-md border border-line-soft bg-white p-2.5">
            <p className="m-0 text-[11px] text-faint">提问：{example.prompt}</p>
            <p className="m-0 mt-1 font-mono text-[11px] break-all text-slate-700">{example.response_preview}</p>
            <p className="m-0 mt-1 text-[10px] text-faint">
              {example.outcome === 'valid' ? '有效' : example.outcome === 'transport_failure' ? '传输失败' : '格式无效'}
              {example.reason ? ` · ${example.reason}` : ''}
            </p>
          </div>
        ))}
      </div>
    </details>
  )
}

function FailureDiagnostics({ evidence }: { evidence: Report['evidence'] }) {
  const totalTransport = evidence.transport_failures
  const totalInvalid = evidence.invalid
  if (!totalTransport && !totalInvalid && !evidence.historical_detail_notice) return null
  const transportByCategory = new Map<string, number>()
  const normalizationByCode = new Map<string, { label: string; count: number }>()
  for (const cell of evidence.cells) {
    for (const item of cell.transport_failure_summary) {
      const key = `${item.category}${item.http_status ? ` (HTTP ${item.http_status})` : ''}`
      transportByCategory.set(key, (transportByCategory.get(key) ?? 0) + item.count)
    }
    for (const item of cell.normalization_failures) {
      const existing = normalizationByCode.get(item.label)
      normalizationByCode.set(item.label, { label: item.label, count: (existing?.count ?? 0) + item.count })
    }
  }
  return (
    <Surface>
      <SectionHeader eyebrow="FAILURE BREAKDOWN" title="采集异常汇总" description="请求没成功（超时、被拒等）和回答格式不符合要求，分开统计，不影响上面的差异度评分。" />
      {evidence.historical_detail_notice && (
        <p className="m-0 mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{evidence.historical_detail_notice}</p>
      )}
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <div>
          <p className="m-0 mb-2 text-xs font-bold text-slate-600">传输失败（{totalTransport}）</p>
          {transportByCategory.size ? (
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {[...transportByCategory.entries()].map(([key, count]) => (
                <li key={key} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-muted"><span className="font-mono">{key}</span><strong className="text-slate-700">× {count}</strong></li>
              ))}
            </ul>
          ) : <p className="m-0 text-xs text-faint">无</p>}
        </div>
        <div>
          <p className="m-0 mb-2 text-xs font-bold text-slate-600">格式失败（{totalInvalid}）</p>
          {normalizationByCode.size ? (
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {[...normalizationByCode.values()].map(item => (
                <li key={item.label} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-muted"><span>{item.label}</span><strong className="text-slate-700">× {item.count}</strong></li>
              ))}
            </ul>
          ) : <p className="m-0 text-xs text-faint">无</p>}
        </div>
      </div>
    </Surface>
  )
}

function RunMetaCard({ report, totalPlanned }: { report: Report; totalPlanned: number }) {
  const { run, evidence } = report
  const target = auditTarget(run)
  const rows: Array<[string, string]> = [
    ['任务编号', run.id],
    ['类型', run.kind === 'audit' ? '真实性检验' : '基线采集'],
    ...(run.kind === 'audit' ? [
      ['站点地址', run.request?.suspect_base_url ?? '—'],
      ['被测模型', target.model ?? report.profile?.api_model_id ?? '—'],
      ...(target.label ? [['备注', target.label] as [string, string]] : []),
    ] as Array<[string, string]> : []),
    ['创建时间', fullDateLabel(run.created_at)],
    ['开始时间', fullDateLabel(run.started_at)],
    ['结束时间', fullDateLabel(run.finished_at)],
    ['耗时', durationLabel(run.started_at, run.finished_at)],
    ['样本预算', totalPlanned ? `${totalPlanned} 次请求` : '—'],
    ['实际尝试', `${evidence.attempted} 次`],
    ['有效率', percent(evidence.valid_rate)],
  ]
  return (
    <Surface>
      <SectionHeader eyebrow="RUN" title="任务信息" />
      <dl className="m-0 grid">
        {rows.map(([dt, dd]) => (
          <div key={dt} className="flex justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
            <dt className="text-xs text-faint">{dt}</dt>
            <dd className="m-0 text-right font-mono text-[11px] break-all text-slate-700">{dd}</dd>
          </div>
        ))}
      </dl>
      {run.error && <p className="m-0 mt-3 rounded-md border border-danger-200 bg-danger-100 px-3 py-2 font-mono text-[11px] break-all text-danger-700">{run.error}</p>}
    </Surface>
  )
}

function ProfileCard({ report }: { report: Report }) {
  const profile = report.profile!
  return (
    <Surface>
      <SectionHeader eyebrow="BASELINE" title="参考基线" />
      <div className="mb-3 flex items-center gap-2">
        <StatusPill status={profile.state} />
        <span className="text-[11px] text-faint">{PROTOCOL_LABELS[profile.protocol]}</span>
      </div>
      <dl className="m-0 grid">
        {([
          ['模型', profile.model_id],
          ['API Model ID', profile.api_model_id],
          ['阈值', `${profile.threshold.match_threshold} / ${profile.threshold.mismatch_threshold}`],
          ['采样参数', `T=${profile.sampling.temperature ?? 1.0} · top-p=${profile.sampling.top_p ?? 1.0} · max=${profile.sampling.max_output_tokens ?? 32}`],
          ['基线更新', fullDateLabel(profile.updated_at)],
        ] as Array<[string, string]>).map(([dt, dd]) => (
          <div key={dt} className="flex justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
            <dt className="text-xs text-faint">{dt}</dt>
            <dd className="m-0 text-right font-mono text-[11px] break-all text-slate-700">{dd}</dd>
          </div>
        ))}
      </dl>
      <Link to="/profiles" className="mt-3 inline-block text-xs font-bold text-accent-600 hover:text-accent-700">查看基线管理</Link>
    </Surface>
  )
}

function QualityCard({ report }: { report: Report }) {
  const quality = report.quality!
  const reasons = quality.reasons ?? []
  const actions = quality.recommended_actions ?? []
  return (
    <Surface>
      <SectionHeader eyebrow="BASELINE QUALITY" title="基线质量门槛" />
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <TimerReset size={14} />
        观察到的有效率 {percent(quality.observed_valid_rate)} · 要求 ≥ {percent(quality.minimum_valid_rate, 0)}
      </div>
      {reasons.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {reasons.map(reason => (
            <li key={reasonKey(reason)} className="flex items-start gap-2 rounded-md bg-danger-100 px-3 py-2 text-xs text-danger-700">
              <CircleAlert size={14} className="mt-0.5 flex-none" />
              {reasonText(reason)}
            </li>
          ))}
        </ul>
      )}
      {actions.length > 0 && (
        <ul className="m-0 mt-3 grid list-disc gap-1 pl-5 text-xs text-muted">
          {actions.map(action => <li key={action}>{action}</li>)}
        </ul>
      )}
    </Surface>
  )
}
