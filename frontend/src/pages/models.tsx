import { Boxes, Check, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { PageContent, PageHeading } from '../components/layout/app-shell'
import { Button, EmptyState, Field, FormError, inputClass, SectionHeader, Select, Surface } from '../components/ui/primitives'
import { useCreateModel, useDeleteModel, useModels } from '../hooks/queries'
import { displayNameFromModelName, providerLabel } from '../lib/models'
import { PROTOCOL_LABELS, PROTOCOL_PATHS, type Model, type Protocol } from '../lib/types'
import { cn } from '../lib/cn'

const protocolOptions: Protocol[] = ['openai_responses', 'openai_chat_completions', 'anthropic_messages']
const defaultProviders = ['openai', 'anthropic', 'kimi', 'glm', 'deepseek', 'qwen', 'minimax']

export function ModelsPage() {
  const { data: models = [] } = useModels()
  const custom = models.filter(model => model.custom)
  const providers = useMemo(() => Array.from(new Set([...defaultProviders, ...models.map(model => model.provider)])), [models])

  return (
    <PageContent title="模型目录">
      <PageHeading eyebrow="MODEL CATALOG" title="模型目录" description="管理可用于基线采集和站点检验的模型。内置模型保持不变，手动添加的模型会保存到当前数据目录。" />
      <div className="grid gap-4">
        <Surface>
          <SectionHeader eyebrow="CUSTOM MODELS" title="手动添加的模型" description="填写厂商、支持协议和模型名后，模型会立即出现在采集与检验流程中。" />
          {custom.length ? <div className="grid">{custom.map(model => <CustomModelRow key={model.id} model={model} />)}</div> : <EmptyState icon={Boxes} title="还没有自定义模型" description="你可以为第三方厂商或私有部署模型添加目录项。" />}
        </Surface>
        <ModelForm providers={providers} />
      </div>
    </PageContent>
  )
}

function CustomModelRow({ model }: { model: Model & { custom?: boolean } }) {
  const [confirming, setConfirming] = useState(false)
  const deleteModel = useDeleteModel()
  return (
    <article className="flex items-start gap-3 border-t border-line-soft py-4 first:border-0 first:pt-0">
      <span className="grid size-9 flex-none place-items-center rounded-lg bg-accent-100 text-accent-600"><Boxes size={18} /></span>
      <div className="min-w-0 flex-1">
        <strong className="block text-[13px] text-slate-700">{model.display_name}</strong>
        <code className="mt-0.5 block break-all font-mono text-[11px] text-muted">{model.id}</code>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded bg-slate-100 px-1.5 py-1 text-[10px] font-semibold text-slate-600">{providerLabel(model.provider)}</span>
          {model.protocols.map(protocol => <span key={protocol} className="rounded bg-accent-50 px-1.5 py-1 text-[10px] text-accent-700">{PROTOCOL_LABELS[protocol]}</span>)}
        </div>
      </div>
      {confirming ? (
        <span className="flex flex-none items-center gap-1.5 max-sm:flex-wrap max-sm:justify-end">
          <button onClick={() => deleteModel.mutate(model.id, { onSuccess: () => setConfirming(false) })} disabled={deleteModel.isPending} className="cursor-pointer rounded-md bg-danger-700 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-red-800">确认删除</button>
          <button onClick={() => setConfirming(false)} title="取消删除" className="grid size-7 cursor-pointer place-items-center rounded-md text-faint hover:bg-slate-100"><X size={14} /></button>
        </span>
      ) : <button onClick={() => setConfirming(true)} title="删除自定义模型" className="grid size-8 cursor-pointer place-items-center rounded-md text-faint hover:bg-danger-100 hover:text-danger-700"><Trash2 size={15} /></button>}
    </article>
  )
}

function ModelForm({ providers }: { providers: string[] }) {
  const createModel = useCreateModel()
  const [provider, setProvider] = useState(providers[0] ?? 'openai')
  const [customProvider, setCustomProvider] = useState('')
  const [modelName, setModelName] = useState('')
  const [protocols, setProtocols] = useState<Protocol[]>(['openai_chat_completions'])
  const [error, setError] = useState('')
  const isCustomProvider = provider === '__custom__'

  function toggleProtocol(protocol: Protocol) {
    setProtocols(current => current.includes(protocol) ? current.filter(item => item !== protocol) : [...current, protocol])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const selectedProvider = (isCustomProvider ? customProvider : provider).trim()
    if (!selectedProvider || !modelName.trim() || protocols.length === 0) {
      setError('请完整填写厂商、模型名并至少选择一种协议。')
      return
    }
    try {
      await createModel.mutateAsync({ provider: selectedProvider, model_name: modelName.trim(), protocols })
      setModelName('')
      setCustomProvider('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存模型失败')
    }
  }

  return (
    <Surface>
      <SectionHeader eyebrow="ADD MODEL" title="添加模型" description="模型名用于请求网关，展示名会根据模型名自动生成。" />
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
          <Field label="厂商">
            <Select value={provider} onChange={setProvider} options={[...providers.map(value => ({ value, label: providerLabel(value) })), { value: '__custom__', label: '自定义厂商' }]} />
          </Field>
          {isCustomProvider ? <Field label="厂商名称"><input required className={inputClass} placeholder="例如：my-company" value={customProvider} onChange={event => setCustomProvider(event.target.value)} /></Field> : <Field label="厂商标识"><div className="flex h-11 items-center rounded-lg border border-line bg-slate-50 px-3 font-mono text-[13px] text-muted">{provider}</div></Field>}
        </div>
        <Field label="模型名" hint="用于请求网关的 model 字段">
          <input required className={inputClass} placeholder="例如：my-model-v1" value={modelName} onChange={event => setModelName(event.target.value)} />
        </Field>
        {modelName.trim() && <div className="-mt-2 rounded-lg border border-line bg-slate-50 px-3.5 py-3 text-xs text-muted">自动展示名：<strong className="text-slate-700">{displayNameFromModelName(modelName)}</strong></div>}
        <Field label="支持协议" hint="至少选择一种">
          <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
            {protocolOptions.map(protocol => {
              const selected = protocols.includes(protocol)
              return <button type="button" key={protocol} onClick={() => toggleProtocol(protocol)} className={cn('grid min-h-18 cursor-pointer content-start rounded-lg border p-3 text-left transition-shadow', selected ? 'border-accent-500 bg-accent-50 ring-2 ring-accent-500/10' : 'border-line bg-white hover:border-slate-300')}>
                <span className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700"><span>{PROTOCOL_LABELS[protocol]}</span><span className={cn('grid size-4.5 place-items-center rounded-full border', selected ? 'border-accent-600 bg-accent-600 text-white' : 'border-line bg-white')}>{selected && <Check size={11} strokeWidth={3} />}</span></span>
                <small className="mt-1 font-mono text-[10px] text-faint">{PROTOCOL_PATHS[protocol]}</small>
              </button>
            })}
          </div>
        </Field>
        <FormError message={error} />
        <div className="flex justify-end border-t border-line-soft pt-4"><Button type="submit" disabled={createModel.isPending}><Plus size={16} />{createModel.isPending ? '保存中…' : '添加模型'}</Button></div>
      </form>
    </Surface>
  )
}
