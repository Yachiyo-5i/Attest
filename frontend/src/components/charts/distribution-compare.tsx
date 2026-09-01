import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

/**
 * 调色板（已通过 dataviz validate_palette 六项检查，浅色表面）：
 * 参考基线 = #3658df（品牌蓝，固定第 1 序），待测端点 = #e06a4f（珊瑚，固定第 2 序）
 * CVD 最差 ΔE 26.7，正常视觉 ΔE 35.4，对比度 ≥ 3:1
 */
const REFERENCE_COLOR = '#3658df'
const SUSPECT_COLOR = '#e06a4f'

type Row = { answer: string; reference: number; suspect: number }

function toRows(reference: Record<string, number>, suspect?: Record<string, number>): Row[] {
  const refTotal = Object.values(reference).reduce((a, b) => a + b, 0) || 1
  const susTotal = Object.values(suspect ?? {}).reduce((a, b) => a + b, 0) || 1
  const keys = [...new Set([...Object.keys(reference), ...Object.keys(suspect ?? {})])]
  keys.sort((a, b) => {
    const na = Number(a)
    const nb = Number(b)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    return a.localeCompare(b, 'zh-CN')
  })
  return keys.map(key => ({
    answer: key,
    reference: Math.round(((reference[key] ?? 0) / refTotal) * 1000) / 10,
    suspect: Math.round(((suspect?.[key] ?? 0) / susTotal) * 1000) / 10,
  }))
}

export function DistributionCompare({ reference, suspect, height = 190 }: {
  reference: Record<string, number>
  suspect?: Record<string, number>
  height?: number
}) {
  const rows = toRows(reference, suspect)
  const twoSeries = suspect !== undefined
  if (!rows.length) {
    return <p className="m-0 py-8 text-center text-xs text-faint">没有有效答案分布</p>
  }
  const crowded = rows.length > 12
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barGap={2} barCategoryGap={crowded ? 2 : 6} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="#edf0f4" />
          <XAxis
            dataKey="answer"
            tick={{ fontSize: crowded ? 9 : 11, fill: '#8a96a9' }}
            tickLine={false}
            axisLine={{ stroke: '#e1e5ed' }}
            interval={0}
            angle={crowded ? -40 : 0}
            textAnchor={crowded ? 'end' : 'middle'}
            height={crowded ? 42 : 24}
          />
          <YAxis tick={{ fontSize: 10, fill: '#8a96a9' }} tickLine={false} axisLine={false} unit="%" width={44} />
          <Tooltip
            cursor={{ fill: '#f6f7fb' }}
            formatter={(value, name) => [`${value ?? 0}%`, name === 'reference' ? '基准（可信来源）' : '被测站点']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e1e5ed' }}
          />
          {twoSeries && (
            <Legend
              formatter={(value: string) => (value === 'reference' ? '基准（可信来源）' : '被测站点')}
              wrapperStyle={{ fontSize: 11, color: '#6e7d94' }}
              iconSize={9}
            />
          )}
          <Bar dataKey="reference" name="reference" fill={REFERENCE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={crowded ? 10 : 22} isAnimationActive={false} />
          {twoSeries && <Bar dataKey="suspect" name="suspect" fill={SUSPECT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={crowded ? 10 : 22} isAnimationActive={false} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
