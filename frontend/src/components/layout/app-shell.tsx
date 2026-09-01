import { useQuery } from '@tanstack/react-query'
import { ChartNoAxesCombined, Database, DatabaseZap, History, LogOut, PanelLeftClose, PanelLeftOpen, RadioTower, TestTube2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useProfiles } from '../../hooks/queries'

const navigation = [
  {
    group: '检验工作区',
    items: [
      { path: '/', label: '工作台', icon: ChartNoAxesCombined, end: true },
      { path: '/audit', label: '新建检验', icon: TestTube2 },
      { path: '/runs', label: '检验记录', icon: History },
    ],
  },
  {
    group: '配置',
    items: [
      { path: '/gateway', label: '参考网关', icon: RadioTower },
      { path: '/enroll', label: '基线采集', icon: DatabaseZap },
      { path: '/profiles', label: '基线管理', icon: Database },
    ],
  },
]

const titles: Record<string, string> = {
  '/': '工作台',
  '/audit': '新建检验',
  '/runs': '检验记录',
  '/gateway': '参考网关',
  '/enroll': '基线采集',
  '/profiles': '基线管理',
}

export function pageTitle(pathname: string) {
  return pathname.startsWith('/runs/') ? '检验报告' : (titles[pathname] ?? '工作台')
}

export function AppShell() {
  const [compact, setCompact] = useState(false)
  const navigate = useNavigate()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api('/api/auth/me'), retry: false, staleTime: 60_000 })
  const { data: profiles } = useProfiles(me.isSuccess)
  const readyProfiles = profiles?.filter(p => p.state === 'calibrated' || p.state === 'baseline_ready').length ?? 0

  if (me.isError) return <Navigate to="/login" replace />
  if (me.isPending) {
    return (
      <div className="grid min-h-screen place-items-center content-center gap-2.5 text-sm text-muted">
        <img src="/logo.png" alt="Attest" className="mx-auto size-8 rounded-lg" />
        <span>正在打开工作区</span>
      </div>
    )
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-ink-950 p-3">
      <aside className={cn('sticky top-3 flex h-[calc(100vh-24px)] flex-none flex-col rounded-2xl bg-ink-950 px-3 py-4 text-ink-100 transition-[width]', compact ? 'w-18' : 'w-60')}>
        <div className={cn('flex h-10 items-center gap-2.5 px-2 text-white', compact && 'justify-center px-0')}>
          <img src="/logo.png" alt="Attest" className="size-8 flex-none rounded-lg shadow-lg shadow-accent-600/30" />
          {!compact && (
            <div className="grid min-w-0">
              <strong className="text-[17px] leading-tight">Attest</strong>
              <span className="text-[10px] tracking-wide text-ink-300 uppercase">Verification lab</span>
            </div>
          )}
          {!compact && (
            <button aria-label="收起侧栏" title="收起侧栏" onClick={() => setCompact(true)} className="ml-auto grid size-7 cursor-pointer place-items-center rounded-md text-ink-300 hover:bg-ink-700 hover:text-white">
              <PanelLeftClose size={17} />
            </button>
          )}
        </div>
        {compact && (
          <button aria-label="展开侧栏" title="展开侧栏" onClick={() => setCompact(false)} className="mx-auto mt-2 grid size-7 cursor-pointer place-items-center rounded-md text-ink-300 hover:bg-ink-700 hover:text-white">
            <PanelLeftOpen size={17} />
          </button>
        )}
        <div className="grid gap-6 py-8">
          {navigation.map(group => (
            <div key={group.group}>
              {!compact && <p className="mx-2 mb-2 text-[10px] font-bold tracking-[0.12em] text-ink-400">{group.group}</p>}
              {group.items.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    title={item.label}
                    className={({ isActive }) => cn(
                      'flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold text-ink-200 hover:bg-ink-700/60 hover:text-white',
                      isActive && 'bg-ink-600 text-white',
                      compact && 'justify-center px-0',
                    )}
                  >
                    <Icon size={17} className="flex-none" />
                    {!compact && <span>{item.label}</span>}
                    {!compact && item.path === '/audit' && readyProfiles > 0 && (
                      <b className="ml-auto rounded-lg bg-accent-500 px-1.5 py-0.5 text-[10px] text-white">{readyProfiles}</b>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </div>
        <div className={cn('mt-auto border-t border-ink-700 px-2 pt-4', compact && 'flex justify-center px-0')}>
          <button onClick={logout} className="flex cursor-pointer items-center gap-2 text-xs text-ink-200 hover:text-white" title="退出登录">
            <LogOut size={16} />
            {!compact && <span>退出登录</span>}
          </button>
        </div>
      </aside>
      <div className="ml-3 min-w-0 flex-1 rounded-2xl bg-canvas">
        <Outlet />
      </div>
    </div>
  )
}

export function PageContent({ children, title, breadcrumb }: { children: ReactNode; title?: string; breadcrumb?: Array<{ label: string; to?: string }> }) {
  return (
    <main className="mx-auto max-w-330 px-6 py-8 pb-18 lg:px-10">
      <div className="mb-6 flex h-8 items-center gap-2 text-[13px]">
        {breadcrumb?.length ? (
          <nav className="flex items-center gap-1.5 text-faint">
            {breadcrumb.map((item, index) => (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 && <span className="text-line">/</span>}
                {item.to ? (
                  <Link to={item.to} className="font-semibold text-muted hover:text-accent-600">{item.label}</Link>
                ) : (
                  <strong className="font-bold text-slate-700">{item.label}</strong>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <strong className="font-bold text-slate-700">{title}</strong>
        )}
      </div>
      {children}
    </main>
  )
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div>
        <p className="mb-2 text-[10px] font-extrabold tracking-[0.14em] text-faint">{eyebrow}</p>
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="m-0 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
      </div>
      {action}
    </div>
  )
}
