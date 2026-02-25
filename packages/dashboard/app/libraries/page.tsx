export const dynamic = 'force-dynamic'

import { getDepsData } from '@/lib/data'
import Badge from '@/components/Badge'
import CoverageBar from '@/components/CoverageBar'

const TABLE_LIMIT = 500

export default async function LibrariesPage() {
  const data = await getDepsData()
  const allDeps = data.topSharedDeps ?? []
  const deps = allDeps.slice(0, TABLE_LIMIT)
  const totalShared = Object.values(data.frequency).filter(f => f.clients.length >= 2).length

  // Heatmap: clients × top shared deps (top 30)
  const heatmapDeps = deps.slice(0, 30)
  const clientIds = data.clients.map(c => c.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Libraries</h1>
        <p className="text-sm text-muted mt-1">
          {totalShared} dependencies shared across 2 or more clients
        </p>
      </div>

      {/* Heatmap */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Dependency matrix — top 30 shared
        </h2>
        <div className="border border-border rounded overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-3 py-2 text-muted font-medium w-48 min-w-48">Package</th>
                {clientIds.map(id => {
                  const client = data.clients.find(c => c.id === id)!
                  return (
                    <th key={id} className="px-2 py-2 text-center min-w-16">
                      <span className={`${client.layer === 'EL' ? 'text-el' : 'text-cl'}`}>
                        {id}
                      </span>
                    </th>
                  )
                })}
                <th className="px-3 py-2 text-muted font-medium text-left">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {heatmapDeps.map((dep, i) => (
                <tr key={dep.canonicalId ?? dep.purl} className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-surface/20'}`}>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-text truncate max-w-40" title={dep.purl}>
                        {dep.name}
                      </span>
                      {dep.canonicalId && <Badge label={dep.canonicalId} variant="cross" />}
                    </div>
                    <div className="text-muted">{dep.ecosystem}</div>
                  </td>
                  {clientIds.map(id => {
                    const has = dep.clients.includes(id)
                    const client = data.clients.find(c => c.id === id)!
                    return (
                      <td key={id} className="px-2 py-1.5 text-center">
                        {has ? (
                          <div
                            className={`w-4 h-4 rounded mx-auto ${client.layer === 'EL' ? 'bg-el' : 'bg-cl'}`}
                            title={id}
                          />
                        ) : (
                          <div className="w-4 h-4 rounded mx-auto bg-border/20" />
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5">
                    <CoverageBar el={dep.elCoverage} cl={dep.clCoverage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full table */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          All shared dependencies
          {allDeps.length > TABLE_LIMIT && (
            <span className="ml-2 normal-case font-normal text-muted">
              (showing top {TABLE_LIMIT} of {allDeps.length})
            </span>
          )}
        </h2>
        <div className="border border-border rounded overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Package</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium"># Clients</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Clients</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">EL / CL Coverage</th>
              </tr>
            </thead>
            <tbody>
              {deps.map((dep, i) => (
                <tr
                  key={dep.canonicalId ?? dep.purl}
                  className={`border-b border-border/50 hover:bg-surface/50 ${i % 2 === 0 ? '' : 'bg-surface/20'}`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text">{dep.name}</span>
                      {dep.isCrossLayer && <Badge label="EL+CL" variant="cross" />}
                      {dep.canonicalId && <Badge label={dep.canonicalId} variant="cross" />}
                    </div>
                    <div className="text-xs text-muted">{dep.ecosystem}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-text">{dep.clients.length}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {dep.clients.map(id => {
                        const client = data.clients.find(c => c.id === id)
                        return <Badge key={id} label={id} variant={client?.layer === 'EL' ? 'el' : 'cl'} />
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <CoverageBar el={dep.elCoverage} cl={dep.clCoverage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
