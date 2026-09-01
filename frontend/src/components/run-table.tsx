import { ArrowUpRight, FileSearch2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { auditTarget, dateLabel } from '../lib/format'
import { cn } from '../lib/cn'
import type { Run } from '../lib/types'
import { RunActions } from './run-actions'
import { EmptyState, StatusPill } from './ui/primitives'

export function RunSymbol({ kind, className }: { kind: Run['kind']; className?: string }) {
  return (
    <span className={cn(
      'grid size-8 flex-none place-items-center rounded-lg text-xs font-extrabold',
      kind === 'audit' ? 'bg-accent-100 text-accent-600' : 'bg-emerald-50 text-emerald-700',
      className,
    )}>
      {kind === 'audit' ? 'A' : 'B'}
    </span>
  )
}

/** 列表行的主标题与副标题：检验显示「站点 · 模型」，采集显示「模型 · 协议」，不显示内部 ID */
export function runTitle(run: Run): { title: string; subtitle: string } {
  if (run.kind === 'audit') {
    const { label, host, model } = auditTarget(run)
    const site = label ?? host ?? '待测站点'
    return {
      title: site,
      subtitle: [model, label && host].filter(Boolean).join(' · ') || run.profile_id,
    }
  }
  return { title: '基线采集', subtitle: run.profile_id.replace('.reference-gateway.v1', '') }
}

export function RunTable({ runs, onCreate, limit = 8 }: { runs: Run[]; onCreate: () => void; limit?: number }) {
  const navigate = useNavigate()
  if (!runs.length) {
    return (
      <EmptyState
        icon={FileSearch2}
        title="还没有检验记录"
        description="先采集一个模型基线，就可以检验待测站点是否掺水。"
        action={
          <button className="flex cursor-pointer items-center gap-1 text-xs font-bold text-accent-600" onClick={onCreate}>
            发起首次检验 <ArrowUpRight size={15} />
          </button>
        }
      />
    )
  }
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1.6fr)_110px_110px_minmax(0,0.9fr)_36px] gap-4 border-b border-line pb-2.5 text-[11px] font-bold tracking-wider text-faint uppercase max-md:hidden">
        <span>任务</span><span>状态</span><span>创建时间</span><span>结果</span><span />
      </div>
      {runs.slice(0, limit).map(run => {
        const { title, subtitle } = runTitle(run)
        return (
          <article
            key={run.id}
            onClick={() => navigate(`/runs/${run.id}`)}
            className="grid cursor-pointer grid-cols-[minmax(0,1.6fr)_110px_110px_minmax(0,0.9fr)_36px] items-center gap-4 border-b border-line-soft py-3.5 transition-colors last:border-0 hover:bg-slate-50 max-md:grid-cols-[minmax(0,1fr)_auto]"
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
  )
}

export function RunsLink() {
  return <Link to="/runs" className="flex items-center gap-1 text-xs font-bold whitespace-nowrap text-accent-600 hover:text-accent-700">全部记录 <ArrowUpRight size={14} /></Link>
}
