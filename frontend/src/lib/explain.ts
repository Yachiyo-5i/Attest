import { ciBounds } from './format'
import type { CellComparison, Comparison } from './types'

/**
 * 人话翻译层：把 JSD、置信区间、分布差异等技术指标
 * 翻成不需要任何背景知识也能看懂的文案。
 */

/** 每个 Probe Cell 实际问了模型什么 */
export const CELL_QUESTIONS: Record<string, string> = {
  number_1_10_zh: '随口报一个 1~10 的数字（中文提问）',
  number_1_10_en: '随口报一个 1~10 的数字（英文提问）',
  coin: '随口报硬币正面还是反面',
  color: '随口报一种颜色',
  letter: '随口报一个英文字母',
}

export type Similarity = 'alike' | 'unsure' | 'different'

export const SIMILARITY_LABEL: Record<Similarity, string> = {
  alike: '很像',
  unsure: '有差别，说不准',
  different: '明显不一样',
}

export function similarityOf(jsd: number | null | undefined, match: number, mismatch: number): Similarity | null {
  if (jsd === null || jsd === undefined) return null
  if (jsd <= match) return 'alike'
  if (jsd >= mismatch) return 'different'
  return 'unsure'
}

/**
 * 结果稳不稳：置信区间明显宽过判定带（很像线到很不像线的距离），
 * 说明样本太少，这个数值下次测可能明显不同。
 */
export function stabilityOf(ci: CellComparison['ci_95'], match: number, mismatch: number): 'stable' | 'shaky' | null {
  const bounds = ciBounds(ci)
  if (!bounds) return null
  return bounds[1] - bounds[0] > (mismatch - match) * 1.5 ? 'shaky' : 'stable'
}

function topAnswers(dist: Record<string, number>, n = 2): string {
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1
  return Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([answer, value]) => `「${answer}」${Math.round((value / total) * 100)}%`)
    .join('、')
}

/** 一句话说清两边各自最常说的答案 */
export function differenceSentence(cell: CellComparison): string | null {
  if (!Object.keys(cell.reference_distribution).length || !Object.keys(cell.suspect_distribution).length) return null
  return `基准最常说 ${topAnswers(cell.reference_distribution)}；被测站点最常说 ${topAnswers(cell.suspect_distribution)}。`
}

export type AuditNarrative = {
  headline: string
  meaning: string
  source: string | null
  confidence: string | null
}

/** 审计判定的大白话版本 */
export function auditNarrative(status: string, comparison: Comparison | null | undefined, cellLabels: Record<string, string>, match: number, mismatch: number): AuditNarrative | null {
  const cells = comparison?.cells ?? []
  const comparable = cells.filter(cell => cell.status === 'comparable')
  const diffCells = comparable.filter(cell => similarityOf(cell.jsd, match, mismatch) === 'different')
  const shakyCount = comparable.filter(cell => stabilityOf(cell.ci_95, match, mismatch) === 'shaky').length

  const source = diffCells.length
    ? `差异主要来自：${diffCells.map(cell => cellLabels[cell.cell_id] ?? cell.cell_id).join('、')}`
    : null
  const confidence = cells.length
    ? `${comparable.length}/${cells.length} 道题证据充分${shakyCount ? `，其中 ${shakyCount} 道题样本偏少、数值可能会晃` : '，采样充足'}`
    : null

  switch (status) {
    case 'CONSISTENT_WITH_REFERENCE':
      return {
        headline: '对得上：像是同一个模型',
        meaning: '被测站点回答这批「随便选一个」问题时的习惯，和可信基准对得上。在当前的测试强度下，没有发现中途偷换模型的迹象。',
        source,
        confidence,
      }
    case 'INCOMPATIBLE_WITH_REFERENCE':
      return {
        headline: '对不上：回答习惯明显不同',
        meaning: '被测站点回答这批问题时的习惯，和可信基准明显对不上。可能是不同的模型，也可能生成参数被动过手脚。差异最大的题目见下方标红的卡片。',
        source,
        confidence,
      }
    case 'INCONCLUSIVE':
      return {
        headline: '说不准：证据还不够',
        meaning: '现有证据不足以判断像或不像——通常是有效回答太少，或请求失败太多。把每格样本数调大重新测一次，一般就能得出结论。',
        source,
        confidence,
      }
    default:
      return null
  }
}
