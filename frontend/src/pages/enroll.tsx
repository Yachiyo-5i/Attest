import { Check, Database, RadioTower, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContent, PageHeading } from '../components/layout/app-shell'
import { Button, EmptyState, Field, FormError, NumberInput, Select, StatusPill, Surface } from '../components/ui/primitives'
import { useGateways, useModels, useProfiles, useStartEnrollment } from '../hooks/queries'
import { BATTERY_CELL_COUNT, PROTOCOL_LABELS, PROTOCOL_PATHS, type Protocol } from '../lib/types'
import { cn } from '../lib/cn'
import { groupModelsByProvider } from '../lib/models'

export function SampleControl({ count, onChange }: { count: number; onChange: (count: number) => void }) {
  return (
    <Field label="每个检查项的采样次数">
      <NumberInput value={count} onChange={onChange} suffix={`共 ${count * BATTERY_CELL_COUNT} 次请求`} />
    </Field>
  )
}

function StepHeader({ step, title, description }: { step: number; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-6 flex-none place-items-center rounded-full bg-accent-100 text-xs font-extrabold text-accent-600">{step}</span>
      <div>
        <p className="m-0 text-sm font-bold text-slate-800">{title}</p>
        {description && <p className="m-0 mt-0.5 text-xs text-muted">{description}</p>}
      </div>
    </div>
  )
}

export function EnrollPage() {
  const { data: models = [] } = useModels()
  const { data: gateways = [] } = useGateways()
  const { data: profiles = [] } = useProfiles()
  const startEnrollment = useStartEnrollment()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [modelId, setModelId] = useState(searchParams.get('model') ?? '')
  const [protocol, setProtocol] = useState<Protocol>((searchParams.get('protocol') as Protocol) || 'openai_responses')
  const [gatewayId, setGatewayId] = useState('')
  const [sampleCount, setSampleCount] = useState(40)
  const [error, setError] = useState('')

  const model = models.find(item => item.id === modelId)
  const protocols = model?.protocols ?? []

  useEffect(() => { if (models.length && !models.some(m => m.id === modelId)) setModelId(models[0].id) }, [models, modelId])
  useEffect(() => { if (protocols.length && !protocols.includes(protocol)) setProtocol(protocols[0]) }, [protocols, protocol])
  useEffect(() => { if (gateways.length && !gatewayId) setGatewayId(gateways[0].id) }, [gateways, gatewayId])

  const existing = profiles.find(p => p.model_id === modelId && p.protocol === protocol)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const result = await startEnrollment.mutateAsync({ model_id: modelId, protocol, gateway_id: gatewayId, sample_count: sampleCount })
      navigate(`/runs/${result.run_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法启动基线采集')
    }
  }

  if (!gateways.length) {
    return (
      <PageContent title="基线采集">
        <PageHeading eyebrow="BASELINE" title="建立模型基线" description="先从参考网关采集模型的行为分布，作为后续检验的基准。" />
        <Surface>
          <EmptyState icon={RadioTower} title="需要先添加参考网关" description="基线只能从参考网关采集，请先完成网关配置。" action={<Button variant="secondary" onClick={() => navigate('/gateway')}>前往配置</Button>} />
        </Surface>
      </PageContent>
    )
  }

  return (
    <PageContent title="基线采集">
      <PageHeading
        eyebrow="BASELINE"
        title="建立模型基线"
        description="以固定的协议和采样设置，从参考网关收集模型的行为分布。每个模型与协议的组合单独保存。"
        action={<span className="rounded-md bg-slate-100 px-2.5 py-2 text-xs font-bold whitespace-nowrap text-slate-500">{profiles.length} 个已登记基线</span>}
      />
      <Surface>
        <form onSubmit={submit} className="grid gap-7">
          <section className="grid gap-4.5">
            <StepHeader step={1} title="选择模型" />
            <Field label="目标模型">
              <Select value={modelId} onChange={setModelId} groups={groupModelsByProvider(models)} />
            </Field>
          </section>

          <section className="grid gap-4.5 border-t border-line-soft pt-6">
            <StepHeader step={2} title="选择协议" description="协议决定与模型对话的请求格式；参考与待测会使用完全相同的协议。" />
            <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
              {protocols.map(item => (
                <button
                  type="button"
                  key={item}
                  className={cn(
                    'relative grid min-h-15 cursor-pointer content-start rounded-lg border border-line bg-white p-3 pr-9 text-left transition-shadow',
                    protocol === item ? 'border-accent-500 bg-accent-50 ring-2 ring-accent-500/10' : 'hover:border-slate-300',
                  )}
                  onClick={() => setProtocol(item)}
                >
                  <span className="block text-xs font-bold text-slate-700">{PROTOCOL_LABELS[item]}</span>
                  <small className="mt-1 block font-mono text-[10px] text-faint">{PROTOCOL_PATHS[item]}</small>
                  <span className={cn(
                    'absolute top-3 right-3 grid size-4.5 place-items-center rounded-full border',
                    protocol === item ? 'border-accent-600 bg-accent-600 text-white' : 'border-line bg-white',
                  )}>
                    {protocol === item && <Check size={11} strokeWidth={3} />}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4.5 border-t border-line-soft pt-6">
            <StepHeader step={3} title="采集设置" />
            <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
              <Field label="参考网关">
                <Select value={gatewayId} onChange={setGatewayId} options={gateways.map(gateway => ({ value: gateway.id, label: gateway.name }))} />
              </Field>
              <SampleControl count={sampleCount} onChange={setSampleCount} />
            </div>
            {existing && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-muted">
                <StatusPill status={existing.state} />
                <span>该模型与协议已有基线，本次采集会覆盖更新。</span>
              </div>
            )}
            <div className="flex gap-2.5 rounded-lg bg-slate-50 p-3.5 text-muted">
              <SlidersHorizontal size={17} className="mt-0.5 flex-none text-accent-500" />
              <p className="m-0 text-xs leading-relaxed">默认使用 temperature 1.0、top-p 1.0 与一组固定的短问答检查项。请求参数是否被网关接受会单独记录，不影响分布对比。</p>
            </div>
          </section>

          <FormError message={error} />
          <div className="flex justify-end border-t border-line-soft pt-5">
            <Button type="submit" disabled={startEnrollment.isPending}>
              {startEnrollment.isPending ? '正在创建任务…' : <><Database size={16} />{existing ? '重新采集基线' : '开始采集基线'}</>}
            </Button>
          </div>
        </form>
      </Surface>
    </PageContent>
  )
}
