import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// Load .env from the repo root (3 dirs up from packages/collector/src/)
// Falls through silently in CI where vars are injected directly
dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { CLIENTS } from './config.js'
import { fetchNetworkShares } from './lib/networkShare.js'

import { lookupCanonical } from './normalize/canonical.js'
import { normalizePurl } from './normalize/purl.js'
import { SYSTEM_LIBS } from './lib/search.js'

import { collectGeth } from './clients/geth.js'
import { collectErigon } from './clients/erigon.js'
import { collectPrysm } from './clients/prysm.js'
import { collectReth } from './clients/reth.js'
import { collectLighthouse } from './clients/lighthouse.js'
import { collectLodestar } from './clients/lodestar.js'
import { collectBesu } from './clients/besu.js'
import { collectTeku } from './clients/teku.js'
import { collectNethermind } from './clients/nethermind.js'
import { collectNimbus } from './clients/nimbus.js'

import type { ClientConfig, ClientResult, NormalizedDep, FrequencyEntry, DepsOutput, SharedDep, EcosystemStat, NativeDepEntry } from './types.js'

const collectors: Record<string, (config: ClientConfig) => Promise<ClientResult>> = {
  geth: collectGeth,
  erigon: collectErigon,
  prysm: collectPrysm,
  reth: collectReth,
  lighthouse: collectLighthouse,
  lodestar: collectLodestar,
  besu: collectBesu,
  teku: collectTeku,
  nethermind: collectNethermind,
  nimbus: collectNimbus,
}

async function runCollector(config: ClientConfig): Promise<{ result: ClientResult | null; error?: string }> {
  const collect = collectors[config.id]
  if (!collect) {
    console.warn(`  [${config.id}] no collector registered — skipping`)
    return { result: null, error: 'no collector registered' }
  }
  try {
    console.log(`  [${config.id}] collecting...`)
    const result = await collect(config)
    const prodCount = result.deps.filter(d => !d.isDev).length
    console.log(`  [${config.id}] done — ${prodCount} prod deps (tag: ${result.scannedTag})`)
    return { result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`  [${config.id}] FAILED: ${message}`, err)
    return { result: null, error: message }
  }
}

function computeFrequency(
  results: ClientResult[],
): Record<string, FrequencyEntry> {
  const frequency: Record<string, FrequencyEntry> = {}
  const clientLayer = new Map(results.map(r => [r.client.id, r.client.layer]))

  for (const result of results) {
    const prodDeps = result.deps.filter(d => !d.isDev)
    for (const dep of prodDeps) {
      const purl = normalizePurl(dep.purl)
      if (!frequency[purl]) {
        frequency[purl] = {
          clients: [],
          elCoverage: 0,
          clCoverage: 0,
          isCrossLayer: false,
        }
      }
      const entry = frequency[purl]
      if (!entry.clients.includes(result.client.id)) {
        entry.clients.push(result.client.id)
        entry.elCoverage += result.client.elNetworkShare
        entry.clCoverage += result.client.clNetworkShare
      }
    }
  }

  // Mark cross-layer and attach canonical IDs
  for (const [purl, entry] of Object.entries(frequency)) {
    const hasEL = entry.clients.some(id => clientLayer.get(id) === 'EL')
    const hasCL = entry.clients.some(id => clientLayer.get(id) === 'CL')
    entry.isCrossLayer = hasEL && hasCL
    const canonicalId = lookupCanonical(purl)
    if (canonicalId) entry.canonicalId = canonicalId
  }

  return frequency
}

// Maps PURL type prefix to human-readable ecosystem label.
// 'npm' maps to 'typescript' because Lodestar is the only npm client and its
// client.ecosystem is 'typescript' — aligning this keeps the Libraries and
// Ecosystems pages consistent.
const PURL_ECO_MAP: Record<string, string> = {
  golang: 'go',
  cargo: 'rust',
  maven: 'java',
  nuget: 'dotnet',
  npm: 'typescript',
  github: 'nim',
}

function purlToName(purl: string): string {
  const path = purl
    .replace(/^pkg:[^/]+\//, '')
    .replace(/@[^@/]*$/, '')
    .replace(/%40/g, '@')
  const parts = path.split('/')
  if (parts.length >= 2 && /^v\d+$/.test(parts[parts.length - 1])) {
    return parts.slice(Math.max(0, parts.length - 3)).join('/')
  }
  return parts.slice(Math.max(0, parts.length - 2)).join('/')
}

function purlToEcosystem(purl: string): string {
  const type = purl.split(':')[1]?.split('/')[0] ?? 'unknown'
  return PURL_ECO_MAP[type] ?? type
}

function computeTopSharedDeps(
  frequency: Record<string, FrequencyEntry>,
  results: ClientResult[],
): SharedDep[] {
  const clientShares = new Map(results.map(r => [r.client.id, { el: r.client.elNetworkShare, cl: r.client.clNetworkShare }]))
  const clientLayer = new Map(results.map(r => [r.client.id, r.client.layer]))

  const groups = new Map<string, SharedDep>()
  for (const [purl, entry] of Object.entries(frequency)) {
    const groupKey = entry.canonicalId ?? purl
    const existing = groups.get(groupKey)
    if (!existing) {
      groups.set(groupKey, {
        purl,
        name: entry.canonicalId ?? purlToName(purl),
        ecosystem: entry.canonicalId ? 'cross-ecosystem' : purlToEcosystem(purl),
        clients: [...entry.clients],
        elCoverage: 0,
        clCoverage: 0,
        isCrossLayer: false,
        canonicalId: entry.canonicalId,
      })
    } else {
      for (const c of entry.clients) {
        if (!existing.clients.includes(c)) existing.clients.push(c)
      }
    }
  }

  for (const group of groups.values()) {
    let hasEL = false
    let hasCL = false
    for (const clientId of group.clients) {
      const share = clientShares.get(clientId)
      if (share) {
        group.elCoverage += share.el
        group.clCoverage += share.cl
      }
      const layer = clientLayer.get(clientId)
      if (layer === 'EL') hasEL = true
      if (layer === 'CL') hasCL = true
    }
    group.isCrossLayer = hasEL && hasCL
  }

  return Array.from(groups.values())
    .filter(e => e.clients.length >= 2)
    .sort((a, b) => b.clients.length - a.clients.length || (b.elCoverage + b.clCoverage) - (a.elCoverage + a.clCoverage))
}

function computeEcosystemStats(
  frequency: Record<string, FrequencyEntry>,
  results: ClientResult[],
): Record<string, EcosystemStat> {
  const stats: Record<string, EcosystemStat> = {}
  const clientEco = new Map<string, string>()
  for (const result of results) {
    const eco = result.client.ecosystem
    clientEco.set(result.client.id, eco)
    if (!stats[eco]) stats[eco] = { clients: [], sharedDeps: 0, totalDeps: 0 }
    stats[eco].clients.push(result.client.id)
  }
  for (const entry of Object.values(frequency)) {
    const ecoClientCount = new Map<string, number>()
    for (const id of entry.clients) {
      const eco = clientEco.get(id)
      if (eco) ecoClientCount.set(eco, (ecoClientCount.get(eco) ?? 0) + 1)
    }
    for (const [eco, count] of ecoClientCount) {
      if (!stats[eco]) continue
      stats[eco].totalDeps++
      if (count >= 2) stats[eco].sharedDeps++
    }
  }
  return stats
}

function computeNativeDeps(results: ClientResult[]): NativeDepEntry[] {
  const nativeFreq: Record<string, NativeDepEntry> = {}
  const clientLayer = new Map(results.map(r => [r.client.id, r.client.layer]))

  for (const result of results) {
    for (const dep of result.deps.filter(d => !d.isDev && d.depType === 'native')) {
      const libName = dep.nativeLib ?? dep.name
      if (SYSTEM_LIBS.has(libName.toLowerCase())) continue
      const canonicalId = lookupCanonical(dep.purl) ?? lookupCanonical(libName)
      const key = canonicalId ?? libName
      if (!nativeFreq[key]) {
        nativeFreq[key] = {
          nativeLib: libName,
          clients: [],
          elCoverage: 0,
          clCoverage: 0,
          isCrossLayer: false,
          ...(canonicalId ? { canonicalId } : {}),
        }
      }
      const entry = nativeFreq[key]
      if (!entry.clients.includes(result.client.id)) {
        entry.clients.push(result.client.id)
        entry.elCoverage += result.client.elNetworkShare
        entry.clCoverage += result.client.clNetworkShare
      }
    }
  }

  for (const entry of Object.values(nativeFreq)) {
    const hasEL = entry.clients.some(id => clientLayer.get(id) === 'EL')
    const hasCL = entry.clients.some(id => clientLayer.get(id) === 'CL')
    entry.isCrossLayer = hasEL && hasCL
  }

  return Object.values(nativeFreq).sort((a, b) => b.clients.length - a.clients.length)
}

function buildOutput(results: ClientResult[], frequency: Record<string, FrequencyEntry>, failedClients: Array<{ id: string; error: string }>, networkSharesSource: DepsOutput['networkSharesSource']): DepsOutput {
  const deps: Record<string, NormalizedDep[]> = {}

  for (const result of results) {
    deps[result.client.id] = result.deps
      .filter(d => !d.isDev)
      .map(d => ({
        purl: normalizePurl(d.purl),
        name: d.name,
        version: d.version,
        ecosystem: d.purl.split(':')[1]?.split('/')[0] ?? 'unknown',
        depType: d.depType,
        canonicalId: lookupCanonical(d.purl) ?? lookupCanonical(d.nativeLib ?? ''),
      }))
  }

  return {
    generatedAt: new Date().toISOString(),
    clients: results.map(r => ({
      ...r.client,
      scannedTag: r.scannedTag,
      scannedAt: r.scannedAt,
      tagPinned: r.tagPinned,
      limitations: r.limitations,
    })),
    deps,
    frequency,
    failedClients,
    networkSharesSource,
    topSharedDeps: computeTopSharedDeps(frequency, results),
    ecosystemStats: computeEcosystemStats(frequency, results),
    nativeDeps: computeNativeDeps(results),
  }
}

async function main() {
  console.log('eth-dependency collector')
  console.log('========================')

  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required')
  }

  // Fetch live network shares (falls back to hardcoded values per client if unavailable)
  console.log('Fetching network share data...')
  const { shares: liveShares, ...networkSharesSource } = await fetchNetworkShares()

  // Merge live shares into client configs (fall back to hardcoded value if live fetch returned 0)
  const clients = CLIENTS.map(c => {
    const live = liveShares.get(c.id)
    return {
      ...c,
      elNetworkShare: (live?.el ?? 0) > 0 ? live!.el : c.elNetworkShare,
      clNetworkShare: (live?.cl ?? 0) > 0 ? live!.cl : c.clNetworkShare,
    }
  })

  const results: ClientResult[] = []
  const failedClients: Array<{ id: string; error: string }> = []

  // Run collectors sequentially to respect rate limits
  for (const client of clients) {
    const { result, error } = await runCollector(client)
    if (result) {
      results.push(result)
    } else if (error) {
      failedClients.push({ id: client.id, error })
    }
  }

  if (failedClients.length > 0) {
    console.warn(`\nWARNING: ${failedClients.length} client(s) failed: ${failedClients.map(f => f.id).join(', ')}`)
    if (failedClients.length > 3) {
      console.warn('More than 3 clients failed — output may be significantly incomplete')
    }
  }

  console.log(`\nCollected ${results.length}/${clients.length} clients`)
  console.log('Computing frequency...')

  const frequency = computeFrequency(results)
  const output = buildOutput(results, frequency, failedClients, networkSharesSource)

  // Write to data/deps.json atomically (tmp + rename) to avoid partial writes on kill
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const outputPath = join(__dirname, '../../../data/deps.json')
  mkdirSync(dirname(outputPath), { recursive: true })
  const tmpPath = outputPath + '.tmp'
  writeFileSync(tmpPath, JSON.stringify(output, null, 2))
  renameSync(tmpPath, outputPath)

  const totalUnique = Object.keys(frequency).length
  const crossLayer = Object.values(frequency).filter(f => f.isCrossLayer).length
  console.log(`\nOutput written to data/deps.json`)
  console.log(`  Unique deps: ${totalUnique}`)
  console.log(`  Cross-layer: ${crossLayer}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
