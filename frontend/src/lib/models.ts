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

const DISPLAY_NAME_WORDS: Record<string, string> = {
  claude: 'Claude', deepseek: 'DeepSeek', gemma: 'Gemma', glm: 'GLM', gpt: 'GPT',
  kimi: 'Kimi', llama: 'Llama', minimax: 'MiniMax', mistral: 'Mistral', qwen: 'Qwen', yi: 'Yi',
}

export function providerLabel(provider: string) {
  return PROVIDER_LABELS[provider] ?? provider
}

export function displayNameFromModelName(modelName: string) {
  const pieces = modelName.trim().split(/[-_/\s]+/).filter(Boolean)
  if (!pieces.length) return modelName.trim()
  const words = pieces.map(piece => {
    const lower = piece.toLowerCase()
    if (DISPLAY_NAME_WORDS[lower]) return DISPLAY_NAME_WORDS[lower]
    if (/^v\d.*/i.test(piece)) return `V${piece.slice(1)}`
    if (/^[A-Z]{1,5}$/.test(piece)) return piece
    return `${piece.slice(0, 1).toUpperCase()}${piece.slice(1)}`
  })
  if (words.length > 1 && Object.values(DISPLAY_NAME_WORDS).includes(words[0]) && /^\d/.test(words[1])) {
    words.splice(0, 2, `${words[0]}-${words[1]}`)
  }
  return words.join(' ')
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
