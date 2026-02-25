export const dynamic = 'force-dynamic'

import { getDepsData } from '@/lib/data'
import Badge from '@/components/Badge'
import CoverageBar from '@/components/CoverageBar'

export default async function ClientsPage() {
  const data = await getDepsData()

  // Build a map from canonicalId -> all client IDs that have any dep in that canonical group.
  // This lets us detect cross-ecosystem sharing (e.g. pkg:nuget/BouncyCastle ↔ pkg:maven/bcprov).
  const canonicalClientMap = new Map<string, string[]>()
  for (const freq of Object.values(data.frequency)) {
    if (!freq.canonicalId) continue
    const existing = canonicalClientMap.get(freq.canonicalId)
    if (!existing) {
      canonicalClientMap.set(freq.canonicalId, [...freq.clients])
    } else {
      for (const id of freq.clients) {
        if (!existing.includes(id)) existing.push(id)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Clients</h1>
        <p className="text-sm text-muted mt-1">Per-client dependency breakdown and overlap with other clients</p>
      </div>

      <div className="space-y-4">
        {data.clients.map(client => {
          const clientDeps = data.deps[client.id] ?? []
          const packageDeps = clientDeps.filter(d => d.depType === 'package')
          const nativeDeps = clientDeps.filter(d => d.depType === 'native')

          // A dep is "shared" if its PURL is used by 2+ clients directly,
          // OR if its canonicalId maps to a group used by 2+ clients (cross-ecosystem).
          const sharedDeps = clientDeps.filter(dep => {
            const freq = data.frequency[dep.purl]
            if (!freq) return false
            if (freq.clients.length >= 2) return true
            if (freq.canonicalId) {
              const canonClients = canonicalClientMap.get(freq.canonicalId) ?? []
              return canonClients.length >= 2
            }
            return false
          })

          return (
            <div key={client.id} className="border border-border rounded overflow-hidden">
              {/* Client header */}
              <div className="bg-surface px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-text">{client.name}</span>
                  <Badge label={client.layer} variant={client.layer === 'EL' ? 'el' : 'cl'} />
                  <Badge label={client.ecosystem} variant="muted" />
                  {!client.tagPinned && <Badge label="HEAD only" variant="native" />}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>{client.scannedTag}</span>
                  <span>{packageDeps.length} packages</span>
                  <span>{nativeDeps.length} native</span>
                  <span className="text-cross">{sharedDeps.length} shared</span>
                </div>
              </div>

              {/* Limitations */}
              {(client.limitations.length > 0 || client.ecosystem === 'nim') && (
                <div className="px-4 py-2 bg-native/5 border-b border-border text-xs text-native">
                  {client.limitations.map((l, i) => <div key={i}>⚠ {l}</div>)}
                  {client.ecosystem === 'nim' && (
                    <div>⚠ Nimbus uses <span className="font-mono">pkg:github//</span> PURLs (git submodules), which cannot be cross-matched with Go/Rust/Java package PURLs — &quot;shared with&quot; count will always be 0 for Nimbus</div>
                  )}
                </div>
              )}

              {/* Shared deps */}
              {sharedDeps.length > 0 && (
                <div className="p-4">
                  <div className="text-xs text-muted mb-2 uppercase tracking-wider">Shared with other clients</div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {sharedDeps.slice(0, 30).map(dep => {
                      const freq = data.frequency[dep.purl]!
                      // Use canonical-group clients if available, else direct PURL clients
                      const effectiveClients = freq.canonicalId
                        ? (canonicalClientMap.get(freq.canonicalId) ?? freq.clients)
                        : freq.clients
                      const otherClients = effectiveClients.filter(id => id !== client.id)
                      return (
                        <div key={dep.purl} className="flex items-center gap-3 text-xs">
                          <span className="font-mono text-text truncate w-64" title={dep.purl}>{dep.name}</span>
                          {freq.canonicalId && (
                            <Badge label={freq.canonicalId} variant="cross" />
                          )}
                          <div className="flex gap-1">
                            {otherClients.map(id => {
                              const c = data.clients.find(x => x.id === id)
                              return <Badge key={id} label={id} variant={c?.layer === 'EL' ? 'el' : 'cl'} />
                            })}
                          </div>
                          <CoverageBar el={freq.elCoverage} cl={freq.clCoverage} />
                        </div>
                      )
                    })}
                    {sharedDeps.length > 30 && (
                      <div className="text-xs text-muted">+ {sharedDeps.length - 30} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
