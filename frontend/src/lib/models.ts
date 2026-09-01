import type { SelectGroup } from '../components/ui/primitives'
import type { Model } from './types'

/** provider 展示名，保持后端模型目录的登记顺序 */
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  kimi: 'Kimi',
  glm: 'GLM',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  minimax: 'MiniMax',
}

export function providerLabel(provider: string) {
  return PROVIDER_LABELS[provider] ?? provider
}

/** 按模型目录顺序（/api/models 返回顺序）把模型按 provider 分组，供 Select 使用 */
export function groupModelsByProvider(models: Model[]): SelectGroup[] {
  const groups: SelectGroup[] = []
  const index = new Map<string, SelectGroup>()
  for (const model of models) {
    let group = index.get(model.provider)
    if (!group) {
      group = { label: providerLabel(model.provider), options: [] }
      index.set(model.provider, group)
      groups.push(group)
    }
    group.options.push({ value: model.id, label: model.display_name })
  }
  return groups
}
