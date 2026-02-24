import 'dotenv/config'
import { writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { CLIENTS } from './config.js'
import { lookupCanonical } from './normalize/canonical.js'
import { normalizePurl } from './normalize/purl.js'

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

import type { ClientConfig, ClientResult, NormalizedDep, FrequencyEntry, DepsOutput } from './types.js'

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
    const hasEL = entry.clients.some(id => CLIENTS.find(c => c.id === id)?.layer === 'EL')
    const hasCL = entry.clients.some(id => CLIENTS.find(c => c.id === id)?.layer === 'CL')
    entry.isCrossLayer = hasEL && hasCL
    const canonicalId = lookupCanonical(purl)
    if (canonicalId) entry.canonicalId = canonicalId
  }

  return frequency
}

function buildOutput(results: ClientResult[], frequency: Record<string, FrequencyEntry>, failedClients: Array<{ id: string; error: string }>): DepsOutput {
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
  }
}

async function main() {
  console.log('eth-dependency collector')
  console.log('========================')

  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required')
  }

  const results: ClientResult[] = []
  const failedClients: Array<{ id: string; error: string }> = []

  // Run collectors sequentially to respect rate limits
  for (const client of CLIENTS) {
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

  console.log(`\nCollected ${results.length}/${CLIENTS.length} clients`)
  console.log('Computing frequency...')

  const frequency = computeFrequency(results)
  const output = buildOutput(results, frequency, failedClients)

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
