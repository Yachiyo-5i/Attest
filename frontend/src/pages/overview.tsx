import { ArrowRight, Check, Plus, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContent, PageHeading } from '../components/layout/app-shell'
import { RunTable, RunsLink } from '../components/run-table'
import { Button, Metric, SectionHeader, Surface, TextAction } from '../components/ui/primitives'
import { useGateways, useModels, useProfiles, useRuns } from '../hooks/queries'
import { cn } from '../lib/cn'

export function OverviewPage() {
  const { data: models = [] } = useModels()
  const { data: gateways = [] } = useGateways()
  const { data: profiles = [] } = useProfiles()
  const { data: runs = [] } = useRuns()
  const navigate = useNavigate()

  const ready = profiles.filter(p => p.state === 'calibrated' || p.state === 'baseline_ready').length
  const activeRuns = runs.filter(run => run.status === 'running' || run.status === 'queued').length

  const coverage = useMemo(() => [
    { label: 'OpenAI', match: (p: string) => p === 'openai', accent: 'bg-indigo-400' },
    { label: 'Anthropic', match: (p: string) => p === 'anthropic', accent: 'bg-orange-400' },
    { label: '国产模型', match: (p: string) => !['openai', 'anthropic'].includes(p), accent: 'bg-teal-500' },
  ].map(item => ({
    ...item,
    total: models.filter(m => item.match(m.provider)).reduce((t, m) => t + m.protocols.length, 0),
    complete: profiles.filter(p => item.match(p.provider)).length,
  })), [models, profiles])

  const nextStep = gateways.length === 0
    ? { label: '添加参考网关', path: '/gateway', copy: '先保存唯一参考网关与 API Key。' }
    : ready === 0
      ? { label: '建立第一个基线', path: '/enroll', copy: '选择模型与协议，采集参考分布。' }
      : { label: '发起真实性检验', path: '/audit', copy: '对比待测站点与已校准基线的回答习惯。' }

  return (
    <PageContent title="工作台">
      <PageHeading
        eyebrow="AUDIT WORKSPACE"
        title="模型验证工作台"
        description="把参考网关、基线采集和站点检验组织为一条清晰的工作流。"
        action={<Button onClick={() => navigate('/audit')} disabled={ready === 0}><Plus size={17} />新建检验</Button>}
      />

      <section className="mb-4 flex min-h-20 items-center gap-3 rounded-xl border border-accent-100 bg-accent-50 px-5 py-4">
        <div className="grid size-10 place-items-center rounded-lg bg-accent-100 text-accent-600"><Sparkles size={19} /></div>
        <div className="min-w-0">
          <p className="m-0 text-[11px] text-muted">下一步</p>
          <strong className="mr-2 text-sm text-slate-800">{nextStep.label}</strong>
          <span className="text-[13px] text-muted max-md:hidden">{nextStep.copy}</span>
        </div>
        <button onClick={() => navigate(nextStep.path)} className="ml-auto flex cursor-pointer items-center gap-1.5 text-[13px] font-extrabold whitespace-nowrap text-accent-600 hover:text-accent-700">
          开始 <ArrowRight size={16} />
        </button>
      </section>

      <div className="mb-4 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Metric label="可用基线" value={ready} hint={ready ? '可用于检验待测站点' : '完成基线采集后解锁检验'} tone="success" />
        <Metric label="参考网关" value={gateways.length} hint={gateways.length ? '统一管理三种协议' : '尚未配置'} tone="accent" />
        <Metric label="进行中任务" value={activeRuns} hint={activeRuns ? '进度会自动更新' : '当前没有进行中的任务'} />
      </div>

      <div className="mb-4 grid grid-cols-[minmax(0,1.24fr)_minmax(310px,0.76fr)] gap-4 max-lg:grid-cols-1">
        <Surface>
          <SectionHeader eyebrow="PROFILE COVERAGE" title="基线覆盖" description="每个模型与协议的组合都有独立的参考基线。" action={<TextAction onClick={() => navigate('/profiles')}>管理基线 <ArrowRight size={15} /></TextAction>} />
          <div className="grid gap-4.5">
            {coverage.map(item => (
              <div className="grid grid-cols-[110px_minmax(60px,1fr)_60px] items-center gap-3" key={item.label}>
                <div className="flex items-center gap-1.5 text-[13px]">
                  <span className={cn('size-2 rounded-full', item.accent)} />
                  <strong className="font-semibold text-slate-700">{item.label}</strong>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <i className="block h-full rounded-full bg-accent-500" style={{ width: `${item.total ? (item.complete / item.total) * 100 : 0}%` }} />
                </div>
                <span className="text-right text-[13px] font-bold text-slate-700">
                  {item.complete}<small className="font-medium text-faint"> / {item.total}</small>
                </span>
              </div>
            ))}
          </div>
        </Surface>
        <Surface>
          <SectionHeader eyebrow="WORKFLOW" title="工作流" />
          <ol className="m-0 grid list-none gap-4.5 p-0">
            {[
              { done: gateways.length > 0, step: '1', title: '连接参考网关', copy: '定义唯一的基线来源和协议路径。' },
              { done: ready > 0, step: '2', title: '采集模型基线', copy: '为模型和协议建立可校准分布。' },
              { done: false, step: '3', title: '检验待测站点', copy: '生成带统计证据的检验报告。' },
            ].map(item => (
              <li key={item.step} className="relative flex items-start gap-3 not-last:after:absolute not-last:after:top-7 not-last:after:left-3 not-last:after:h-5 not-last:after:w-px not-last:after:bg-line">
                <span className={cn(
                  'grid size-6 flex-none place-items-center rounded-full border text-[11px] font-extrabold',
                  item.done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-line bg-white text-faint',
                )}>
                  {item.done ? <Check size={14} /> : item.step}
                </span>
                <div>
                  <strong className="block text-[13px] text-slate-700">{item.title}</strong>
                  <p className="m-0 mt-0.5 text-xs text-muted">{item.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </Surface>
      </div>

      <Surface>
        <SectionHeader eyebrow="ACTIVITY" title="最近任务" description="任务完成后会自动更新结果。" action={<RunsLink />} />
        <RunTable runs={runs} onCreate={() => navigate('/audit')} />
      </Surface>
    </PageContent>
  )
}
