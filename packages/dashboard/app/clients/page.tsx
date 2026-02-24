export const dynamic = 'force-dynamic'

import { getDepsData } from '@/lib/data'
import Badge from '@/components/Badge'
import CoverageBar from '@/components/CoverageBar'

export default async function ClientsPage() {
  const data = await getDepsData()

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

          // Find deps shared with other clients
          const sharedDeps = clientDeps.filter(dep => {
            const freq = data.frequency[dep.purl]
            return freq && freq.clients.length >= 2
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
                      const otherClients = freq.clients.filter(id => id !== client.id)
                      return (
                        <div key={dep.purl} className="flex items-center gap-3 text-xs">
                          <span className="font-mono text-text truncate w-64" title={dep.purl}>{dep.name}</span>
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
