'use client'

// Force client component since recharts needs browser
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { DepsData } from '@/lib/data'
import { getEcosystemStats } from '@/lib/stats'
import Badge from '@/components/Badge'

const ECO_COLORS: Record<string, string> = {
  go: '#00ADD8',
  rust: '#CE422B',
  java: '#5382A1',
  typescript: '#3178C6',
  dotnet: '#9B4F96',
  nim: '#FFE953',
}

export default function EcosystemsPage() {
  const [data, setData] = useState<DepsData | null>(null)

  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(setData)
  }, [])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        Loading...
      </div>
    )
  }

  const stats = getEcosystemStats(data)

  const chartData = Object.entries(stats).map(([eco, s]) => ({
    ecosystem: eco,
    clients: s.clients.length,
    totalDeps: s.totalDeps,
    sharedDeps: s.sharedDeps,
    sharingRate: s.clients.length > 1 && s.totalDeps > 0
      ? Math.round((s.sharedDeps / s.totalDeps) * 100)
      : 0,
  })).sort((a, b) => b.sharingRate - a.sharingRate)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Ecosystems</h1>
        <p className="text-sm text-muted mt-1">Within-ecosystem dependency sharing rates</p>
      </div>

      {/* Sharing rate chart */}
      <div className="border border-border rounded p-4 bg-surface">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Shared dep rate by ecosystem (among clients using same language)
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="ecosystem" tick={{ fill: '#8b949e', fontSize: 12 }} />
            <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4 }}
              labelStyle={{ color: '#e6edf3' }}
              formatter={(val: number) => [`${val}%`, 'Sharing rate']}
            />
            <Bar dataKey="sharingRate" radius={[2, 2, 0, 0]}>
              {chartData.map(entry => (
                <Cell key={entry.ecosystem} fill={ECO_COLORS[entry.ecosystem] ?? '#8b949e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ecosystem breakdown table */}
      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Ecosystem</th>
              <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Clients</th>
              <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Total deps</th>
              <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Shared deps</th>
              <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Sharing rate</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, i) => (
              <tr key={row.ecosystem} className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-surface/20'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: ECO_COLORS[row.ecosystem] ?? '#8b949e' }} />
                    <span className="font-mono text-text">{row.ecosystem}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {stats[row.ecosystem].clients.map(id => {
                      const client = data.clients.find(c => c.id === id)
                      return <Badge key={id} label={id} variant={client?.layer === 'EL' ? 'el' : 'cl'} />
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-text">{row.totalDeps.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-text">{row.sharedDeps.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${row.sharingRate}%`, background: ECO_COLORS[row.ecosystem] ?? '#8b949e' }}
                      />
                    </div>
                    <span className="font-mono text-text text-xs">{row.sharingRate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Sharing rate = % of deps used by 2+ clients within the same ecosystem.
        Cross-ecosystem sharing (e.g. Go ↔ Rust) is shown on the Libraries page via canonical mappings.
      </p>
    </div>
  )
}
