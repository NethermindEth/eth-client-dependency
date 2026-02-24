export const dynamic = 'force-dynamic'

import { getDepsData } from '@/lib/data'
import Badge from '@/components/Badge'
import CoverageBar from '@/components/CoverageBar'

export default async function NativePage() {
  const data = await getDepsData()

  // Collect all native deps across all clients
  const nativeFreq: Record<string, {
    clients: string[]
    nativeLib: string
    elCoverage: number
    clCoverage: number
    isCrossLayer: boolean
    canonicalId?: string
  }> = {}

  for (const [clientId, deps] of Object.entries(data.deps)) {
    const client = data.clients.find(c => c.id === clientId)
    if (!client) continue

    for (const dep of deps.filter(d => d.depType === 'native')) {
      const key = dep.canonicalId ?? dep.name
      if (!nativeFreq[key]) {
        nativeFreq[key] = {
          clients: [],
          nativeLib: dep.name,
          elCoverage: 0,
          clCoverage: 0,
          isCrossLayer: false,
          canonicalId: dep.canonicalId,
        }
      }
      const entry = nativeFreq[key]
      if (!entry.clients.includes(clientId)) {
        entry.clients.push(clientId)
        entry.elCoverage += client.elNetworkShare
        entry.clCoverage += client.clNetworkShare
      }
    }
  }

  // Mark cross-layer
  for (const entry of Object.values(nativeFreq)) {
    const hasEL = entry.clients.some(id => data.clients.find(c => c.id === id)?.layer === 'EL')
    const hasCL = entry.clients.some(id => data.clients.find(c => c.id === id)?.layer === 'CL')
    entry.isCrossLayer = hasEL && hasCL
  }

  const sorted = Object.entries(nativeFreq)
    .sort((a, b) => b[1].clients.length - a[1].clients.length)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Native Dependencies</h1>
        <p className="text-sm text-muted mt-1">
          C/C++ libraries linked via FFI — detected from -sys crates, CGO directives, JNI and P/Invoke calls
        </p>
      </div>

      {/* Methodology note */}
      <div className="border border-native/30 rounded p-3 bg-native/5 text-xs text-native space-y-1">
        <div className="font-semibold">Detection methodology & limitations</div>
        <ul className="space-y-0.5 text-native/80 list-disc list-inside">
          <li>Rust: <code>-sys</code> crates resolved via crates.io <code>links</code> field</li>
          <li>Go: <code>#cgo</code> directives scanned in source files</li>
          <li>Java: <code>System.loadLibrary()</code> calls scanned in source</li>
          <li>C#: <code>[DllImport]</code> / <code>[LibraryImport]</code> attributes scanned in source</li>
          <li>Indirect CGO deps (transitive) are not detected</li>
          <li>Dynamically loaded libs (<code>dlopen</code>) are not detected</li>
        </ul>
      </div>

      {/* Native deps table */}
      {sorted.length === 0 ? (
        <div className="text-sm text-muted text-center py-8">
          No native dependencies detected yet. Run the collector with native scanning enabled.
        </div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Native Library</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Detected in</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">EL / CL Coverage</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Canonical</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(([key, entry], i) => (
                <tr
                  key={key}
                  className={`border-b border-border/50 hover:bg-surface/50 ${i % 2 === 0 ? '' : 'bg-surface/20'}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-native">{entry.nativeLib}</span>
                      {entry.isCrossLayer && <Badge label="EL+CL" variant="cross" />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {entry.clients.map(id => {
                        const client = data.clients.find(c => c.id === id)
                        return <Badge key={id} label={id} variant={client?.layer === 'EL' ? 'el' : 'cl'} />
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <CoverageBar el={entry.elCoverage} cl={entry.clCoverage} />
                  </td>
                  <td className="px-4 py-2.5">
                    {entry.canonicalId ? (
                      <Badge label={entry.canonicalId} variant="cross" />
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
