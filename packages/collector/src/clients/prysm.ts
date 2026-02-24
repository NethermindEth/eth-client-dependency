import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import { scanCGO } from '../lib/search.js'
import type { ClientConfig, ClientResult, RawDep } from '../types.js'

function parseGoSum(content: string, selfModule: string): RawDep[] {
  const deps: RawDep[] = []
  const seen = new Set<string>()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split(' ')
    if (parts.length < 3) continue

    const [mod, version] = parts
    if (!mod || !version) continue
    if (version.endsWith('/go.mod')) continue
    if (mod.startsWith(selfModule)) continue

    const purl = `pkg:golang/${mod}@${version}`
    if (seen.has(purl)) continue
    seen.add(purl)

    deps.push({ name: mod, version, purl, isDev: false, depType: 'package' })
  }

  return deps
}

export async function collectPrysm(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)
  const gosum = await fetchRaw(config.repo, tag, 'go.sum')
  const packageDeps = parseGoSum(gosum, 'github.com/prysmaticlabs/prysm')
  const nativeDeps = await scanCGO(config.repo, tag)

  return {
    client: config,
    scannedTag: tag,
    scannedAt: new Date().toISOString(),
    tagPinned: true,
    deps: [...packageDeps, ...nativeDeps],
    limitations: [
      'Prysm uses Bazel as primary build system; go.sum reflects Go module deps only',
    ],
  }
}
