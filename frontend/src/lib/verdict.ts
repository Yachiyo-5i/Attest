import { CircleAlert, ShieldCheck, ShieldQuestion, ShieldX, Split, TimerReset, XCircle, type LucideIcon } from 'lucide-react'
import type { DecisionStatus } from '../lib/types'

const verdictConfig: Record<string, { label: string; icon: LucideIcon; banner: string; iconColor: string }> = {
  CONSISTENT_WITH_REFERENCE: {
    label: '与参考一致',
    icon: ShieldCheck,
    banner: 'border-emerald-200 bg-emerald-50',
    iconColor: 'bg-emerald-600 text-white',
  },
  INCOMPATIBLE_WITH_REFERENCE: {
    label: '与参考不兼容',
    icon: ShieldX,
    banner: 'border-danger-200 bg-danger-100',
    iconColor: 'bg-danger-700 text-white',
  },
  MIXED_OR_DYNAMIC_ROUTING: {
    label: '疑似混合或动态路由',
    icon: Split,
    banner: 'border-amber-200 bg-amber-50',
    iconColor: 'bg-amber-500 text-white',
  },
  TRANSPORT_OR_PARAMETER_ALTERED: {
    label: '传输或参数被改写',
    icon: CircleAlert,
    banner: 'border-amber-200 bg-amber-50',
    iconColor: 'bg-amber-500 text-white',
  },
  INCONCLUSIVE: {
    label: '证据不足，无法判定',
    icon: ShieldQuestion,
    banner: 'border-slate-200 bg-slate-50',
    iconColor: 'bg-slate-500 text-white',
  },
  BASELINE_READY: {
    label: '参考基线就绪',
    icon: ShieldCheck,
    banner: 'border-emerald-200 bg-emerald-50',
    iconColor: 'bg-emerald-600 text-white',
  },
  BASELINE_REJECTED: {
    label: '基线未通过质量检查',
    icon: ShieldX,
    banner: 'border-danger-200 bg-danger-100',
    iconColor: 'bg-danger-700 text-white',
  },
  QUEUED: { label: '排队中', icon: TimerReset, banner: 'border-line bg-slate-50', iconColor: 'bg-slate-400 text-white' },
  RUNNING: { label: '运行中', icon: TimerReset, banner: 'border-line bg-slate-50', iconColor: 'bg-slate-400 text-white' },
  COMPLETED: { label: '已完成', icon: ShieldCheck, banner: 'border-line bg-slate-50', iconColor: 'bg-slate-500 text-white' },
  CANCELLED: { label: '已取消', icon: XCircle, banner: 'border-line bg-slate-50', iconColor: 'bg-slate-400 text-white' },
  FAILED: { label: '运行失败', icon: ShieldX, banner: 'border-danger-200 bg-danger-100', iconColor: 'bg-danger-700 text-white' },
}

export function verdictOf(status: DecisionStatus | string) {
  return verdictConfig[status] ?? verdictConfig.INCONCLUSIVE
}
