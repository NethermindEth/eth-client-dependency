export const dynamic = 'force-dynamic'

import { getDepsData } from '@/lib/data'
import Badge from '@/components/Badge'
import CoverageBar from '@/components/CoverageBar'
import FreshnessBar from '@/components/FreshnessBar'

export default async function OverviewPage() {
  const data = await getDepsData()
  const topDeps = data.topSharedDeps?.slice(0, 100) ?? []
  const sharedCount = Object.values(data.frequency).filter(f => f.clients.length >= 2).length
  const crossLayerCount = Object.values(data.frequency).filter(f => f.isCrossLayer).length

  const failedClients = data.failedClients ?? []
  const isStaleFormat = data.topSharedDeps === undefined

  return (
    <div className="space-y-6">
      {/* Failed-client warning */}
      {failedClients.length > 0 && (
        <div className="border border-native/40 rounded p-3 bg-native/5 text-xs text-native space-y-1">
          <div className="font-semibold">
            ⚠ {failedClients.length} client{failedClients.length > 1 ? 's' : ''} failed during the last collection run — coverage figures may be understated
          </div>
          {failedClients.map(f => (
            <div key={f.id} className="text-native/80 font-mono">{f.id}: {f.error}</div>
          ))}
        </div>
      )}

      {/* Stale-format warning */}
      {isStaleFormat && (
        <div className="border border-border rounded p-3 bg-surface text-xs text-muted">
          ⚠ Data file is from an older collector run and is missing pre-computed aggregates. Re-run the collector to see the shared-dependency tables.
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text">Shared Dependency Concentration</h1>
          <p className="text-sm text-muted mt-1">
            Transitive dependency overlap across {data.clients.length} Ethereum execution and consensus clients
          </p>
        </div>
        <FreshnessBar generatedAt={data.generatedAt} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Clients tracked', value: data.clients.length },
          { label: 'Unique dependencies', value: Object.keys(data.frequency).length.toLocaleString() },
          { label: 'Shared (2+ clients)', value: sharedCount.toLocaleString() },
          { label: 'Cross-layer (EL+CL)', value: crossLayerCount.toLocaleString() },
        ].map(stat => (
          <div key={stat.label} className="bg-surface border border-border rounded p-3">
            <div className="text-2xl font-bold font-mono text-text">{stat.value}</div>
            <div className="text-xs text-muted mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Client grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Clients</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {data.clients.map(client => (
            <div key={client.id} className="bg-surface border border-border rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm text-text">{client.name}</span>
                <Badge
                  label={client.layer}
                  variant={client.layer === 'EL' ? 'el' : 'cl'}
                />
              </div>
              <div className="text-xs text-muted">{client.ecosystem}</div>
              <div className="text-xs text-muted mt-1">
                {client.layer === 'EL'
                  ? `${Math.round(client.elNetworkShare * 100)}% of nodes`
                  : `${Math.round(client.clNetworkShare * 100)}% of validators`
                }
              </div>
              <div className="text-xs text-border mt-1">{client.scannedTag}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top shared deps table */}
      {!isStaleFormat && (
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Most shared dependencies
          </h2>
          <div className="border border-border rounded overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Package</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Clients</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">EL / CL Coverage</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {topDeps.map((dep, i) => (
                  <tr
                    key={dep.canonicalId ?? dep.purl}
                    className={`border-b border-border/50 hover:bg-surface/50 transition-colors ${i % 2 === 0 ? '' : 'bg-surface/20'}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text truncate max-w-xs" title={dep.purl}>
                          {dep.name}
                        </span>
                        {dep.canonicalId && (
                          <Badge label={dep.canonicalId} variant="cross" />
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5">{dep.ecosystem}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {dep.clients.map(id => {
                          const client = data.clients.find(c => c.id === id)
                          return (
                            <Badge
                              key={id}
                              label={id}
                              variant={client?.layer === 'EL' ? 'el' : 'cl'}
                            />
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <CoverageBar el={dep.elCoverage} cl={dep.clCoverage} />
                    </td>
                    <td className="px-4 py-2.5">
                      {dep.isCrossLayer ? (
                        <Badge label="EL+CL" variant="cross" />
                      ) : dep.clients[0] && data.clients.find(c => c.id === dep.clients[0])?.layer === 'EL' ? (
                        <Badge label="EL" variant="el" />
                      ) : (
                        <Badge label="CL" variant="cl" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
