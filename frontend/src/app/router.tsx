import { CircleAlert } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link, useRouteError } from 'react-router-dom'
import { AppShell } from '../components/layout/app-shell'
import { LoginPage } from '../pages/login'
import { OverviewPage } from '../pages/overview'
import { GatewayPage } from '../pages/gateway'
import { EnrollPage } from '../pages/enroll'
import { AuditPage } from '../pages/audit'
import { RunsPage } from '../pages/runs'

// 图表页按需加载，把 recharts 拆出主包
const RunDetailPage = lazy(() => import('../pages/run-detail').then(m => ({ default: m.RunDetailPage })))
const ProfilesPage = lazy(() => import('../pages/profiles').then(m => ({ default: m.ProfilesPage })))

const lazyFallback = <div className="grid min-h-60 place-items-center text-sm text-muted">正在载入…</div>

function RouteError() {
  const error = useRouteError()
  return (
    <div className="grid min-h-80 place-items-center p-10 text-center">
      <div>
        <CircleAlert size={28} className="mx-auto mb-3 text-danger-700" />
        <h1 className="m-0 text-lg font-semibold text-slate-800">页面渲染出错</h1>
        <p className="mt-2 max-w-md font-mono text-xs break-all text-muted">{error instanceof Error ? error.message : '未知错误'}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-bold text-accent-600">返回工作台</Link>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'gateway', element: <GatewayPage /> },
      { path: 'enroll', element: <EnrollPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'profiles', element: <Suspense fallback={lazyFallback}><ProfilesPage /></Suspense> },
      { path: 'runs', element: <RunsPage /> },
      { path: 'runs/:runId', element: <Suspense fallback={lazyFallback}><RunDetailPage /></Suspense> },
    ],
  },
])
