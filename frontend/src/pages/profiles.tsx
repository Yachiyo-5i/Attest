import { ChevronDown, Database, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DistributionCompare } from '../components/charts/distribution-compare'
import { PageContent, PageHeading } from '../components/layout/app-shell'
import { EmptyState, SectionHeader, StatusPill, Surface } from '../components/ui/primitives'
import { useModels, useProfiles } from '../hooks/queries'
import { cn } from '../lib/cn'
import { fullDateLabel, percent, reasonKey, reasonText } from '../lib/format'
import { CELL_LABELS, PROTOCOL_LABELS, type Profile } from '../lib/types'

const providerGroups = [
  { label: 'OpenAI', match: (p: string) => p === 'openai' },
  { label: 'Anthropic', match: (p: string) => p === 'anthropic' },
  { label: '国产模型', match: (p: string) => !['openai', 'anthropic'].includes(p) },
]

export function ProfilesPage() {
  const { data: profiles = [] } = useProfiles()
  const { data: models = [] } = useModels()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<string | null>(null)

  const modelName = useMemo(() => new Map(models.map(m => [m.id, m.display_name])), [models])
  const grouped = providerGroups.map(group => ({ ...group, profiles: profiles.filter(p => group.match(p.provider)) }))

  return (
    <PageContent title="基线管理">
      <PageHeading
        eyebrow="BASELINE PROFILES"
        title="基线管理"
        description="每个模型与协议组合的参考基线，包含质量检查、判定阈值与采集时间。只有「已校准 / 基线就绪」的基线可用于检验。"
      />
      {profiles.length === 0 ? (
        <Surface className="max-w-2xl">
          <EmptyState icon={Database} title="还没有任何基线" description="完成一次基线采集后，这里会显示参考分布、质量检查与判定阈值。" action={
            <button className="cursor-pointer text-xs font-bold text-accent-600" onClick={() => navigate('/enroll')}>开始基线采集</button>
          } />
        </Surface>
      ) : (
        <div className="grid gap-4">
          {grouped.filter(g => g.profiles.length > 0).map(group => (
            <Surface key={group.label}>
              <SectionHeader eyebrow="PROVIDER" title={group.label} description={`${group.profiles.length} 个 Profile`} />
              <div className="grid">
                {group.profiles.map(profile => (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    displayName={modelName.get(profile.model_id) ?? profile.model_id}
                    expanded={expanded === profile.id}
                    onToggle={() => setExpanded(expanded === profile.id ? null : profile.id)}
                    onRecollect={() => navigate(`/enroll?model=${profile.model_id}&protocol=${profile.protocol}`)}
                  />
                ))}
              </div>
            </Surface>
          ))}
        </div>
      )}
    </PageContent>
  )
}

function ProfileRow({ profile, displayName, expanded, onToggle, onRecollect }: {
  profile: Profile
  displayName: string
  expanded: boolean
  onToggle: () => void
  onRecollect: () => void
}) {
  const missing = profile.quality?.missing_cells?.length ?? 0
  return (
    <article className="border-t border-line-soft py-4 first:border-0 first:pt-0">
      <div className="grid cursor-pointer grid-cols-[minmax(0,1.4fr)_130px_110px_130px_auto] items-center gap-4 max-md:grid-cols-[minmax(0,1fr)_auto]" onClick={onToggle}>
        <div className="min-w-0">
          <strong className="block text-[13px] text-slate-800">{displayName}</strong>
          <small className="mt-0.5 block truncate font-mono text-[11px] text-faint">{profile.id}</small>
        </div>
        <span className="text-xs text-muted max-md:hidden">{PROTOCOL_LABELS[profile.protocol]}</span>
        <StatusPill status={profile.state} />
        <span className="text-[11px] text-faint max-md:hidden">
          有效率 {percent(profile.quality?.observed_valid_rate)}
          {missing > 0 && <span className="text-warning-700"> · 缺 {missing} Cell</span>}
        </span>
        <span className="flex items-center gap-2 justify-self-end">
          {profile.state === 'failed' && (
            <button
              onClick={event => { event.stopPropagation(); onRecollect() }}
              className="flex cursor-pointer items-center gap-1 rounded-md bg-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
            >
              <RotateCcw size={12} />重新采集
            </button>
          )}
          <ChevronDown size={16} className={cn('text-faint transition-transform', expanded && 'rotate-180')} />
        </span>
      </div>
      {expanded && (
        <div className="mt-4 grid gap-4 rounded-xl bg-slate-50 p-5">
          <dl className="m-0 grid grid-cols-4 gap-3 max-md:grid-cols-2">
            {([
              ['采样预算', `${(profile.sampling.sample_count ?? 0) * 5} 次请求`],
              ['判定阈值', `${profile.threshold.match_threshold} / ${profile.threshold.mismatch_threshold}`],
              ['每 Cell 最少有效', `${profile.quality?.minimum_valid_per_cell ?? '—'} 条`],
              ['更新时间', fullDateLabel(profile.updated_at)],
            ] as Array<[string, string]>).map(([dt, dd]) => (
              <div key={dt}>
                <dt className="text-[10px] tracking-wide text-faint uppercase">{dt}</dt>
                <dd className="m-0 mt-1 text-xs font-bold text-slate-700">{dd}</dd>
              </div>
            ))}
          </dl>
          {profile.quality?.reasons?.length > 0 && (
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {profile.quality.reasons.map(reason => (
                <li key={reasonKey(reason)} className="rounded-md bg-danger-100 px-3 py-2 text-xs text-danger-700">{reasonText(reason)}</li>
              ))}
            </ul>
          )}
          <div className="grid gap-3">
            {Object.entries(profile.baseline ?? {}).map(([cellId, distribution]) => (
              <div key={cellId} className="rounded-lg border border-line-soft bg-white p-4">
                <p className="m-0 mb-2 text-xs font-bold text-slate-700">{CELL_LABELS[cellId] ?? cellId}</p>
                <DistributionCompare reference={distribution} height={150} />
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
