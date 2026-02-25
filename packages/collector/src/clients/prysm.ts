import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import { parseGoSum } from '../lib/gosum.js'
import { scanCGO } from '../lib/search.js'
import type { ClientConfig, ClientResult } from '../types.js'

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
