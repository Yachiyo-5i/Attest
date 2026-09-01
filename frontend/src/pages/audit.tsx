import { Check, ClipboardCheck, Database, Play, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContent, PageHeading } from '../components/layout/app-shell'
import { providerLabel } from '../lib/models'
import { Button, EmptyState, Field, FormError, inputClass, Select, StatusPill, Surface } from '../components/ui/primitives'
import { useModels, useProfiles, useStartAudit } from '../hooks/queries'
import { PROTOCOL_LABELS, PROTOCOL_PATHS } from '../lib/types'
import { SampleControl } from './enroll'

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

export function AuditPage() {
  const { data: profiles = [] } = useProfiles()
  const { data: models = [] } = useModels()
  const startAudit = useStartAudit()
  const navigate = useNavigate()

  // 按基线采集页的模型目录顺序展示（而非建立时间），并按 provider 分组
  const catalogOrder = useMemo(() => new Map(models.map((m, i) => [m.id, i])), [models])
  const usableProfiles = useMemo(
    () => profiles
      .filter(p => p.state === 'calibrated' || p.state === 'baseline_ready')
      .sort((a, b) => (catalogOrder.get(a.model_id) ?? 999) - (catalogOrder.get(b.model_id) ?? 999)),
    [profiles, catalogOrder],
  )
  const profileGroups = useMemo(() => {
    const groups = new Map<string, { label: string; options: Array<{ value: string; label: string }> }>()
    for (const item of usableProfiles) {
      const key = item.provider
      if (!groups.has(key)) groups.set(key, { label: providerLabel(key), options: [] })
      groups.get(key)!.options.push({
        value: item.id,
        label: `${models.find(m => m.id === item.model_id)?.display_name ?? item.model_id} · ${PROTOCOL_LABELS[item.protocol]} · ${item.state === 'calibrated' ? '已校准' : '基线就绪'}`,
      })
    }
    return [...groups.values()]
  }, [usableProfiles, models])
  const [profileId, setProfileId] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [modelId, setModelId] = useState('')
  const [label, setLabel] = useState('')
  const [path, setPath] = useState('')
  const [sampleCount, setSampleCount] = useState(30)
  const [error, setError] = useState('')

  useEffect(() => { if (usableProfiles.length && !usableProfiles.some(p => p.id === profileId)) setProfileId(usableProfiles[0].id) }, [usableProfiles, profileId])
  const profile = usableProfiles.find(item => item.id === profileId)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const result = await startAudit.mutateAsync({
        profile_id: profileId,
        suspect_base_url: url,
        suspect_api_key: key,
        suspect_model_id: modelId || undefined,
        suspect_path: path || undefined,
        label: label.trim() || undefined,
        sample_count: sampleCount,
      })
      setKey('')
      navigate(`/runs/${result.run_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法启动检验')
    }
  }

  if (!usableProfiles.length) {
    return (
      <PageContent title="新建检验">
        <PageHeading eyebrow="AUDIT" title="发起真实性检验" description="选择一个已校准的基线，以相同条件检验待测站点的行为分布。" />
        <Surface>
          <EmptyState
            icon={ClipboardCheck}
            title="还没有可用的基线"
            description="先完成一次基线采集，才能开始检验。"
            action={<Button variant="secondary" onClick={() => navigate('/enroll')}>前往基线采集</Button>}
          />
        </Surface>
      </PageContent>
    )
  }

  return (
    <PageContent title="新建检验">
      <PageHeading eyebrow="AUDIT" title="发起真实性检验" description="选择一个已校准的基线，以相同的协议和采样设置比较待测站点的行为分布。" />
      <Surface>
        <form onSubmit={submit} className="grid gap-7">
          <section className="grid gap-4.5">
            <StepHeader step={1} title="选择参考基线" description="检验结果以该基线的行为分布为基准。" />
            <Field label="基线">
              <Select value={profileId} onChange={setProfileId} groups={profileGroups} />
            </Field>
            {profile && (
              <div className="flex items-center gap-2.5 rounded-lg border border-line bg-slate-50 p-3">
                <span className="grid size-8 place-items-center rounded-lg bg-accent-100 text-accent-600"><Database size={17} /></span>
                <div className="grid min-w-0 gap-0.5">
                  <strong className="text-[13px] text-slate-700">{profile.model_id}</strong>
                  <small className="text-[11px] text-muted">{PROTOCOL_LABELS[profile.protocol]} · 参考网关基线</small>
                </div>
                <StatusPill status={profile.state} className="ml-auto" />
              </div>
            )}
          </section>

          <section className="grid gap-4.5 border-t border-line-soft pt-6">
            <StepHeader step={2} title="填写待测站点" description="只用于本次检验请求，不会保存到检验记录中。" />
            <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
              <Field label="站点地址">
                <input required className={inputClass} placeholder="https://relay.example" value={url} onChange={event => setUrl(event.target.value)} />
              </Field>
              <Field label="API Key">
                <input required type="password" className={inputClass} placeholder="输入待测站点 Key" value={key} onChange={event => setKey(event.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
              <Field label="模型 ID" hint="可选，默认沿用基线">
                <input className={inputClass} placeholder={profile?.api_model_id ?? '继承基线'} value={modelId} onChange={event => setModelId(event.target.value)} />
              </Field>
              <Field label="备注" hint="可选，用于在记录里区分不同站点">
                <input className={inputClass} placeholder="例如：XX 中转站 · 周检" value={label} onChange={event => setLabel(event.target.value)} maxLength={100} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
              <Field label="请求路径" hint="可选，默认按协议">
                <input className={inputClass} placeholder={profile ? PROTOCOL_PATHS[profile.protocol] : '/v1/chat/completions'} value={path} onChange={event => setPath(event.target.value)} />
              </Field>
            </div>
          </section>

          <section className="grid gap-4.5 border-t border-line-soft pt-6">
            <StepHeader step={3} title="请求预算" description="预算越大结论越可靠；处于阈值之间时建议增加预算重新检验。" />
            <SampleControl count={sampleCount} onChange={setSampleCount} />
            <ul className="m-0 grid list-none gap-2.5 rounded-lg bg-slate-50 p-3.5">
              {[
                '逐项比较参考与被测站点的答案分布，并计算统计距离。',
                '对有效样本做置信区间估计，避免单次偶然偏差。',
                '给出"一致 / 不兼容 / 证据不足"的明确结论，而不是模糊的百分比。',
              ].map(copy => (
                <li key={copy} className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                  <Check size={14} className="mt-0.5 flex-none text-emerald-600" />{copy}
                </li>
              ))}
            </ul>
            <div className="flex gap-2.5 rounded-lg bg-slate-50 p-3.5 text-muted">
              <ShieldCheck size={17} className="mt-0.5 flex-none text-accent-500" />
              <p className="m-0 text-xs leading-relaxed">待测站点的 Key 只用于本次检验，不会被保存。</p>
            </div>
          </section>

          <FormError message={error} />
          <div className="flex justify-end border-t border-line-soft pt-5">
            <Button type="submit" disabled={startAudit.isPending}>
              {startAudit.isPending ? '正在启动…' : <><Play size={16} />开始检验</>}
            </Button>
          </div>
        </form>
      </Surface>
    </PageContent>
  )
}
