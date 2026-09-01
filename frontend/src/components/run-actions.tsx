import { Ban, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useCancelRun, useDeleteRun } from '../hooks/queries'
import type { Run } from '../lib/types'

/**
 * 运行记录的取消 / 删除操作。
 * 进行中任务可取消；已结束任务可删除。删除基线采集记录会连带删除对应基线，
 * 需要重新采集后才能检验，因此确认文案明确提示。
 */
export function RunActions({ run, onDeleted }: { run: Run; onDeleted?: () => void }) {
  const cancelRun = useCancelRun()
  const deleteRun = useDeleteRun()
  const [confirming, setConfirming] = useState<null | 'cancel' | 'delete'>(null)
  const active = run.status === 'queued' || run.status === 'running'
  const busy = cancelRun.isPending || deleteRun.isPending

  function stop(event: React.MouseEvent) {
    event.stopPropagation()
    event.preventDefault()
  }

  if (confirming === 'cancel') {
    return (
      <span className="flex flex-none items-center gap-1.5" onClick={stop}>
        <span className="text-[11px] text-muted">已采集的样本会保留在报告中。</span>
        <button
          disabled={busy}
          onClick={async event => { stop(event); await cancelRun.mutateAsync(run.id); setConfirming(null) }}
          className="cursor-pointer rounded-md bg-amber-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? '取消中…' : '确认取消'}
        </button>
        <button onClick={event => { stop(event); setConfirming(null) }} className="grid size-7 cursor-pointer place-items-center rounded-md text-faint hover:bg-slate-100">
          <X size={14} />
        </button>
      </span>
    )
  }

  if (confirming === 'delete') {
    return (
      <span className="flex flex-none items-center gap-1.5" onClick={stop}>
        <span className="max-w-72 text-[11px] leading-snug text-muted">
          {run.kind === 'enrollment'
            ? '将同时删除对应基线；删除后需要重新采集基线才能检验。'
            : '仅删除这条检验记录，不影响基线。'}
        </span>
        <button
          disabled={busy}
          onClick={async event => { stop(event); await deleteRun.mutateAsync(run.id); setConfirming(null); onDeleted?.() }}
          className="cursor-pointer rounded-md bg-danger-700 px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap text-white hover:bg-red-800 disabled:opacity-50"
        >
          {busy ? '删除中…' : '确认删除'}
        </button>
        <button onClick={event => { stop(event); setConfirming(null) }} className="grid size-7 cursor-pointer place-items-center rounded-md text-faint hover:bg-slate-100">
          <X size={14} />
        </button>
      </span>
    )
  }

  return (
    <span className="flex flex-none items-center gap-1" onClick={stop}>
      {active && (
        <button onClick={event => { stop(event); setConfirming('cancel') }} title="取消任务" className="grid size-7 cursor-pointer place-items-center rounded-md text-faint hover:bg-warning-100 hover:text-warning-700">
          <Ban size={14} />
        </button>
      )}
      {!active && (
        <button onClick={event => { stop(event); setConfirming('delete') }} title="删除记录" className="grid size-7 cursor-pointer place-items-center rounded-md text-faint hover:bg-danger-100 hover:text-danger-700">
          <Trash2 size={14} />
        </button>
      )}
    </span>
  )
}
