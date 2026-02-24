'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts'

const ECO_COLORS: Record<string, string> = {
  go: '#00ADD8',
  rust: '#CE422B',
  java: '#5382A1',
  typescript: '#3178C6',
  dotnet: '#9B4F96',
  nim: '#FFE953',
}

export interface EcosystemChartEntry {
  ecosystem: string
  sharingRate: number
}

export default function EcosystemChart({ data }: { data: EcosystemChartEntry[] }) {
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <BarChart data={data} width={700} height={220} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <XAxis dataKey="ecosystem" tick={{ fill: '#8b949e', fontSize: 12 }} />
        <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} unit="%" />
        <Tooltip
          contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4 }}
          labelStyle={{ color: '#e6edf3' }}
          formatter={(val: number) => [`${val}%`, 'Sharing rate']}
        />
        <Bar dataKey="sharingRate" radius={[2, 2, 0, 0]}>
          {data.map(entry => (
            <Cell key={entry.ecosystem} fill={ECO_COLORS[entry.ecosystem] ?? '#8b949e'} />
          ))}
          <LabelList
            dataKey="sharingRate"
            position="top"
            style={{ fill: '#8b949e', fontSize: 11 }}
            formatter={(v: number) => v > 0 ? `${v}%` : ''}
          />
        </Bar>
      </BarChart>
    </div>
  )
}
