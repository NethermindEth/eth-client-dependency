import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import { parseGoSum, parseGoModReplacements } from '../lib/gosum.js'
import { scanCGO } from '../lib/search.js'
import type { ClientConfig, ClientResult } from '../types.js'

export async function collectGeth(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)
  const [gosum, gomod] = await Promise.all([
    fetchRaw(config.repo, tag, 'go.sum'),
    fetchRaw(config.repo, tag, 'go.mod'),
  ])

  const packageDeps = parseGoSum(gosum, 'github.com/ethereum/go-ethereum')
  const replacements = parseGoModReplacements(gomod)

  // Apply replace directives — Geth uses these to redirect some imports
  for (const dep of packageDeps) {
    const replacement = replacements.get(dep.name)
    if (replacement) {
      const [newMod, newVer] = replacement.split('@')
      dep.name = newMod
      dep.version = newVer
      dep.purl = `pkg:golang/${newMod}@${newVer}`
    }
  }

  const nativeDeps = await scanCGO(config.repo, tag)

  return {
    client: config,
    scannedTag: tag,
    scannedAt: new Date().toISOString(),
    tagPinned: true,
    deps: [...packageDeps, ...nativeDeps],
    limitations: [],
  }
}
