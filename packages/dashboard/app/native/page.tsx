export const dynamic = 'force-dynamic'

import { getDepsData } from '@/lib/data'
import Badge from '@/components/Badge'
import CoverageBar from '@/components/CoverageBar'

export default async function NativePage() {
  const data = await getDepsData()
  const nativeDeps = data.nativeDeps ?? []

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
      {nativeDeps.length === 0 ? (
        <div className="text-sm text-muted text-center py-8">
          No native dependencies detected yet. Run the collector with native scanning enabled.
        </div>
      ) : (
        <div className="border border-border rounded overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Native Library</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Detected in</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">EL / CL Coverage</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Canonical</th>
              </tr>
            </thead>
            <tbody>
              {nativeDeps.map((entry, i) => (
                <tr
                  key={entry.canonicalId ?? entry.nativeLib}
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
