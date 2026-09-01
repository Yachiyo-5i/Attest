import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Button, FormError, inputClass } from '../components/ui/primitives'

export function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) })
      queryClient.clear()
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法登录')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_minmax(460px,0.85fr)]">
      <section className="flex flex-col justify-between bg-ink-900 p-10 text-slate-100 lg:p-20">
        <div className="flex items-center gap-2.5 text-lg">
          <img src="/logo.png" alt="Attest" className="size-9 rounded-lg shadow-lg shadow-accent-600/30" />
          <strong>Attest</strong>
        </div>
        <div className="my-16 max-w-xl">
          <p className="mb-2.5 text-[10px] font-extrabold tracking-[0.14em] text-ink-300">PRIVATE MODEL VERIFICATION</p>
          <h1 className="mb-5 text-4xl leading-tight font-semibold tracking-tight lg:text-5xl">
            把模型真实性<br />变成可复现的证据。
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-slate-400">
            从同一参考网关建立基线，以受控协议对比待测端点，并保留每一次判断的统计依据。
          </p>
        </div>
        <div className="flex flex-wrap gap-6 text-[13px] text-slate-400">
          <span className="flex items-center gap-1.5"><Check size={16} className="text-emerald-400" />数据只保存在本机</span>
          <span className="flex items-center gap-1.5"><Check size={16} className="text-emerald-400" />支持主流模型接口</span>
          <span className="flex items-center gap-1.5"><Check size={16} className="text-emerald-400" />报告可随时回看复查</span>
        </div>
      </section>
      <section className="grid place-items-center bg-canvas p-10">
        <form className="grid w-full max-w-96 gap-5" onSubmit={submit}>
          <div className="mb-3">
            <span className="mb-5 grid size-11 place-items-center rounded-xl bg-accent-100 text-accent-600">
              <KeyRound size={20} />
            </span>
            <p className="mb-2 text-[10px] font-extrabold tracking-[0.14em] text-faint">SECURE ACCESS</p>
            <h2 className="mb-2 text-2xl font-semibold text-slate-900">登录工作区</h2>
            <p className="m-0 text-sm text-muted">输入本地管理员密码以继续。</p>
          </div>
          <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
            访问密码
            <input autoFocus type="password" value={password} placeholder="输入密码" onChange={event => setPassword(event.target.value)} className={inputClass} />
          </label>
          <FormError message={error} />
          <Button type="submit" disabled={loading}>
            {loading ? '验证中…' : <>进入 Attest <ArrowRight size={16} /></>}
          </Button>
        </form>
      </section>
    </main>
  )
}
