import { Pencil, Plus, RadioTower, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PageContent, PageHeading } from '../components/layout/app-shell'
import { Button, EmptyState, Field, FormError, inputClass, SectionHeader, Surface } from '../components/ui/primitives'
import { useCreateGateway, useDeleteGateway, useGateways, useUpdateGateway } from '../hooks/queries'
import type { Gateway } from '../lib/types'

const ROUTE_PATHS = ['/v1/responses', '/v1/chat/completions', '/v1/messages']

export function GatewayPage() {
  const { data: gateways = [] } = useGateways()
  return (
    <PageContent title="参考网关">
      <PageHeading eyebrow="REFERENCE SOURCE" title="参考网关" description="所有模型的参考基线都从同一个网关采集，保证对比条件完全一致。" />
      <div className="grid gap-4">
        <Surface>
          <SectionHeader eyebrow="SAVED" title="已保存的网关" />
          {gateways.length ? (
            <div className="grid">
              {gateways.map(gateway => <GatewayRow key={gateway.id} gateway={gateway} />)}
            </div>
          ) : (
            <EmptyState icon={RadioTower} title="尚未添加网关" description="添加一个参考网关后，就可以开始为模型采集基线。" />
          )}
        </Surface>
        <GatewayForm />
      </div>
    </PageContent>
  )
}

function GatewayRow({ gateway }: { gateway: Gateway }) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const deleteGateway = useDeleteGateway()

  if (editing) return <GatewayForm gateway={gateway} onClose={() => setEditing(false)} embedded />

  return (
    <article className="flex items-start gap-3 border-t border-line-soft py-4 first:border-0 first:pt-0">
      <span className="grid size-9 flex-none place-items-center rounded-lg bg-accent-100 text-accent-600"><RadioTower size={18} /></span>
      <div className="min-w-0 flex-1">
        <strong className="block text-[13px] text-slate-700">{gateway.name}</strong>
        <code className="mt-0.5 block font-mono text-[11px] break-all text-muted">{gateway.base_url}</code>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {Object.values(gateway.routes).map(route => (
            <code key={route.path} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{route.path}</code>
          ))}
        </div>
      </div>
      {confirming ? (
        <span className="flex flex-none items-center gap-1.5">
          <button
            onClick={async () => { await deleteGateway.mutateAsync(gateway.id) }}
            className="cursor-pointer rounded-md bg-danger-700 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-red-800"
          >
            确认删除
          </button>
          <button onClick={() => setConfirming(false)} className="grid size-7 cursor-pointer place-items-center rounded-md text-faint hover:bg-slate-100">
            <X size={14} />
          </button>
        </span>
      ) : (
        <span className="flex flex-none items-center gap-1">
          <button onClick={() => setEditing(true)} title="编辑" className="grid size-7 cursor-pointer place-items-center rounded-md text-faint hover:bg-slate-100 hover:text-slate-700">
            <Pencil size={14} />
          </button>
          <button onClick={() => setConfirming(true)} title="删除" className="grid size-7 cursor-pointer place-items-center rounded-md text-faint hover:bg-danger-100 hover:text-danger-700">
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </article>
  )
}

function GatewayForm({ gateway, onClose, embedded = false }: { gateway?: Gateway; onClose?: () => void; embedded?: boolean }) {
  const createGateway = useCreateGateway()
  const updateGateway = useUpdateGateway()
  const [name, setName] = useState(gateway?.name ?? '我的参考网关')
  const [baseUrl, setBaseUrl] = useState(gateway?.base_url ?? '')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const editing = Boolean(gateway)
  const submitting = createGateway.isPending || updateGateway.isPending

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      if (gateway) {
        await updateGateway.mutateAsync({ id: gateway.id, name, base_url: baseUrl, ...(apiKey ? { api_key: apiKey } : {}) })
        onClose?.()
      } else {
        await createGateway.mutateAsync({ name, base_url: baseUrl, api_key: apiKey })
        setName('我的参考网关')
        setBaseUrl('')
        setApiKey('')
        setNotice('网关已保存，可以开始采集模型基线。')
        window.setTimeout(() => setNotice(''), 4200)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const form = (
    <form onSubmit={submit} className="grid gap-4.5">
      <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <Field label="名称">
          <input className={inputClass} value={name} onChange={event => setName(event.target.value)} />
        </Field>
        <Field label="网关地址">
          <input required className={inputClass} placeholder="https://gateway.example" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} />
        </Field>
      </div>
      <Field label="API Key" hint={editing ? '留空表示不修改' : undefined}>
        <input required={!editing} type="password" className={inputClass} placeholder={editing ? '输入新 Key 才会更新' : '输入网关 API Key'} value={apiKey} onChange={event => setApiKey(event.target.value)} />
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-slate-50 px-4 py-3 max-md:grid max-md:gap-2">
        <div>
          <strong className="block text-xs text-slate-700">协议路径</strong>
          <span className="mt-0.5 block text-[11px] text-faint">自动登记三种标准协议路径。</span>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 max-md:justify-start">
          {ROUTE_PATHS.map(path => (
            <code key={path} className="rounded bg-slate-100 px-1.5 py-1 font-mono text-[10px] text-slate-600">{path}</code>
          ))}
        </div>
      </div>
      <FormError message={error} />
      {notice && <p className="m-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-700">{notice}</p>}
      <div className="flex justify-end gap-2 pt-1">
        {onClose && <Button variant="secondary" onClick={onClose}>取消</Button>}
        <Button type="submit" disabled={submitting}>
          {submitting ? '保存中…' : editing ? '保存修改' : <><Plus size={16} />添加网关</>}
        </Button>
      </div>
    </form>
  )

  if (embedded) {
    return <div className="border-t border-line-soft py-4 first:border-0 first:pt-0">{form}</div>
  }
  return (
    <Surface>
      <SectionHeader eyebrow="ADD" title="添加参考网关" description="连接信息只保存在你的数据目录中，不会上传到任何第三方。" />
      {form}
    </Surface>
  )
}
