import { Check, CheckCircle2, ChevronDown, CircleAlert, Clock3, LoaderCircle, XCircle, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, className }: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'quiet'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent-600 text-white shadow-sm hover:bg-accent-700',
        variant === 'secondary' && 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        variant === 'quiet' && 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700',
        className,
      )}
    >
      {children}
    </button>
  )
}

const statusConfig: Record<string, { label: string; icon: LucideIcon; className: string; spin?: boolean }> = {
  completed: { label: '已完成', icon: CheckCircle2, className: 'text-success-700 bg-success-100' },
  running: { label: '运行中', icon: LoaderCircle, className: 'text-warning-700 bg-warning-100', spin: true },
  queued: { label: '等待中', icon: Clock3, className: 'text-slate-500 bg-slate-100' },
  failed: { label: '失败', icon: CircleAlert, className: 'text-danger-700 bg-danger-100' },
  cancelled: { label: '已取消', icon: XCircle, className: 'text-slate-500 bg-slate-100' },
  calibrated: { label: '已校准', icon: CheckCircle2, className: 'text-success-700 bg-success-100' },
  baseline_ready: { label: '基线就绪', icon: CheckCircle2, className: 'text-accent-700 bg-accent-100' },
  BASELINE_READY: { label: '基线就绪', icon: CheckCircle2, className: 'text-success-700 bg-success-100' },
  BASELINE_REJECTED: { label: '基线未通过', icon: XCircle, className: 'text-danger-700 bg-danger-100' },
  CONSISTENT_WITH_REFERENCE: { label: '与参考一致', icon: CheckCircle2, className: 'text-success-700 bg-success-100' },
  INCOMPATIBLE_WITH_REFERENCE: { label: '与参考不兼容', icon: XCircle, className: 'text-danger-700 bg-danger-100' },
  MIXED_OR_DYNAMIC_ROUTING: { label: '疑似动态路由', icon: CircleAlert, className: 'text-warning-700 bg-warning-100' },
  TRANSPORT_OR_PARAMETER_ALTERED: { label: '传输被改写', icon: CircleAlert, className: 'text-warning-700 bg-warning-100' },
  INCONCLUSIVE: { label: '无法判定', icon: Clock3, className: 'text-slate-500 bg-slate-100' },
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const item = statusConfig[status] ?? { label: status, icon: Clock3, className: 'text-slate-500 bg-slate-100' }
  const Icon = item.icon
  return (
    <span className={cn('inline-flex w-max items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold whitespace-nowrap', item.className, className)}>
      <Icon size={13} className={item.spin ? 'animate-spin' : undefined} />
      {item.label}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="grid min-h-44 justify-items-center content-center gap-2.5 p-6 text-center">
      <span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={21} strokeWidth={1.8} />
      </span>
      <strong className="text-sm text-slate-700">{title}</strong>
      <p className="mx-auto max-w-84 text-[13px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  )
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-[10px] font-extrabold tracking-[0.14em] text-faint">{eyebrow}</p>}
        <h2 className="text-[17px] font-semibold text-slate-800">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Metric({ label, value, hint, tone = 'default' }: { label: string; value: string | number; hint: string; tone?: 'default' | 'accent' | 'success' }) {
  return (
    <article className="grid min-h-28 content-between rounded-xl border border-line bg-surface p-5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <strong className={cn('text-3xl tracking-tight text-slate-800', tone === 'success' && 'text-success-600', tone === 'accent' && 'text-accent-600')}>{value}</strong>
      <small className="text-xs text-faint">{hint}</small>
    </article>
  )
}

export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-xl border border-line bg-surface p-6', className)}>{children}</section>
}

export function TextAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex cursor-pointer items-center gap-1 text-xs font-bold whitespace-nowrap text-accent-600 hover:text-accent-700">
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  // 注意：不能用 <label> 包裹——label 会把任意位置的点击转发给内部第一个可标签化控件，
  // 对 NumberInput 这类复合控件来说会导致点哪里都触发 − 按钮。
  return (
    <div className="grid gap-2 text-[13px] font-semibold text-slate-700">
      <span>{label}{hint && <em className="ml-1.5 text-[10px] font-normal not-italic text-faint">{hint}</em>}</span>
      {children}
    </div>
  )
}

export const inputClass =
  'h-11 w-full appearance-none rounded-lg border border-line bg-white px-3 text-[13px] text-slate-800 outline-none transition-shadow focus:border-accent-500 focus:ring-[3px] focus:ring-accent-500/15'

export type SelectOption = { value: string; label: ReactNode }
export type SelectGroup = { label: string; options: SelectOption[] }

export function Select({ value, onChange, options, groups, className, placeholder = '请选择' }: {
  value: string
  onChange: (value: string) => void
  options?: SelectOption[]
  groups?: SelectGroup[]
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const flatOptions = options ?? (groups ?? []).flatMap(group => group.options)
  const selected = flatOptions.find(option => option.value === value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(inputClass, 'flex cursor-pointer items-center justify-between gap-2 text-left', open && 'border-accent-500 ring-[3px] ring-accent-500/15')}
      >
        <span className={cn('truncate', !selected && 'text-faint')}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={16} className={cn('flex-none text-faint transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg shadow-slate-900/8">
          {groups
            ? groups.map(group => (
                <div key={group.label}>
                  <p className="m-0 px-3 pt-2 pb-1 text-[10px] font-extrabold tracking-[0.08em] text-faint uppercase first:pt-1">{group.label}</p>
                  {group.options.map(option => renderOption(option))}
                </div>
              ))
            : flatOptions.map(option => renderOption(option))}
        </div>
      )}
    </div>
  )

  function renderOption(option: SelectOption) {
    return (
      <button
        type="button"
        key={option.value}
        onClick={() => { onChange(option.value); setOpen(false) }}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50',
          option.value === value && 'font-semibold text-accent-700',
        )}
      >
        <span className="truncate">{option.label}</span>
        {option.value === value && <Check size={14} className="flex-none" />}
      </button>
    )
  }
}

export function NumberInput({ value, onChange, min = 2, max = 500, step = 5, suffix }: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  const clamp = (next: number) => onChange(Math.min(max, Math.max(min, Number.isFinite(next) ? next : min)))
  return (
    <div className="flex items-center">
      <button type="button" onClick={() => clamp(value - step)} className="h-10 w-9 cursor-pointer rounded-l-lg border border-line bg-white text-slate-600 hover:bg-slate-50">−</button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={event => clamp(Number(event.target.value))}
        className="h-10 w-18 border-y border-line bg-white text-center text-[13px] text-slate-700 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => clamp(value + step)} className="h-10 w-9 cursor-pointer rounded-r-lg border border-line bg-white text-slate-600 hover:bg-slate-50">＋</button>
      {suffix && <small className="ml-2.5 text-xs text-muted">{suffix}</small>}
    </div>
  )
}

export function FormError({ message }: { message: string }) {
  if (!message) return null
  return <p className="m-0 rounded-md border border-danger-200 bg-danger-100 px-3 py-2.5 text-[13px] text-danger-700">{message}</p>
}
