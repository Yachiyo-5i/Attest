import { FileSearch2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContent, PageHeading } from '../components/layout/app-shell'
import { RunActions } from '../components/run-actions'
import { RunSymbol, runTitle } from '../components/run-table'
import { EmptyState, StatusPill, Surface } from '../components/ui/primitives'
import { useRuns } from '../hooks/queries'
import { cn } from '../lib/cn'
import { dateLabel } from '../lib/format'
import type { Run, RunKind, RunStatus } from '../lib/types'

const kindFilters: Array<{ value: RunKind | 'all'; label: string }> = [
  { value: 'all', label: '全部类型' },
  { value: 'audit', label: '真实性检验' },
  { value: 'enrollment', label: '基线采集' },
]

const statusFilters: Array<{ value: RunStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'completed', label: '已完成' },
  { value: 'running', label: '运行中' },
  { value: 'queued', label: '等待中' },
  { value: 'failed', label: '失败' },
]

export function RunsPage() {
  const { data: runs = [] } = useRuns()
  const navigate = useNavigate()
  const [kind, setKind] = useState<RunKind | 'all'>('all')
  const [status, setStatus] = useState<RunStatus | 'all'>('all')

  const filtered = useMemo(
    () => runs.filter(run => (kind === 'all' || run.kind === kind) && (status === 'all' || run.status === status)),
    [runs, kind, status],
  )

  return (
    <PageContent title="检验记录">
      <PageHeading eyebrow="RUN HISTORY" title="检验记录" description="全部基线采集与真实性检验任务；点击任意一行查看完整报告。" />
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { current: kind, setter: setKind, options: kindFilters },
          { current: status, setter: setStatus, options: statusFilters },
        ].map((group, groupIndex) => (
          <div key={groupIndex} className="flex rounded-lg border border-line bg-surface p-1">
            {group.options.map(option => (
              <button
                key={option.value}
                onClick={() => group.setter(option.value as never)}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold text-muted hover:text-slate-700',
                  group.current === option.value && 'bg-accent-600 text-white hover:text-white',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <Surface>
        {!filtered.length ? (
          <EmptyState icon={FileSearch2} title="没有符合条件的记录" description={runs.length ? '调整筛选条件查看其他记录。' : '先采集一个模型基线，就可以检验待测站点是否掺水。'} />
        ) : (
          <div>
            <div className="grid grid-cols-[minmax(0,1.7fr)_110px_130px_minmax(0,0.9fr)_36px] gap-4 border-b border-line pb-2.5 text-[11px] font-bold tracking-wider text-faint uppercase max-md:hidden">
              <span>任务</span><span>状态</span><span>创建时间</span><span>结果</span><span />
            </div>
            {filtered.map(run => {
              const { title, subtitle } = runTitle(run)
              return (
              <article
                key={run.id}
                onClick={() => navigate(`/runs/${run.id}`)}
                className="grid cursor-pointer grid-cols-[minmax(0,1.7fr)_110px_130px_minmax(0,0.9fr)_36px] items-center gap-4 border-b border-line-soft py-3.5 transition-colors last:border-0 hover:bg-slate-50 max-md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <RunSymbol kind={run.kind} />
                  <div className="min-w-0">
                    <strong className="block truncate text-[13px] text-slate-700">{title}</strong>
                    <small className="mt-0.5 block truncate text-[11px] text-faint">{subtitle}</small>
                  </div>
                </div>
                <StatusPill status={run.status} />
                <time className="text-xs text-muted max-md:hidden">{dateLabel(run.created_at)}</time>
                <span className="truncate text-[11px] font-semibold text-muted max-md:hidden">
                  {run.result?.verdict?.replaceAll('_', ' ') ?? (run.error ? '需要检查' : '—')}
                </span>
                <RunActions run={run} />
              </article>
              )
            })}
          </div>
        )}
      </Surface>
    </PageContent>
  )
}
