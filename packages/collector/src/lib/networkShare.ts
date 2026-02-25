import { withRetry } from './fetch.js'

const BLOCKPRINT_API = 'https://api.blockprint.sigp.io'
// Ethernodes node-count snapshots committed daily to the clientdiversity.org repo
const ETHERNODES_RAW_URL =
  'https://raw.githubusercontent.com/etheralpha/clientdiversity-org/main/_data/raw/ethernodes_raw.json'

// Blockprint client name → our client ID
const BLOCKPRINT_TO_ID: Record<string, string> = {
  Lighthouse: 'lighthouse',
  Prysm: 'prysm',
  Teku: 'teku',
  Nimbus: 'nimbus',
  Lodestar: 'lodestar',
}

// Ethernodes client name → our client ID
const ETHERNODES_TO_ID: Record<string, string> = {
  geth: 'geth',
  nethermind: 'nethermind',
  besu: 'besu',
  erigon: 'erigon',
  reth: 'reth',
}

export interface NetworkShareResult {
  shares: Map<string, { el: number; cl: number }>
  elSource: 'ethernodes' | 'hardcoded'
  clSource: 'blockprint' | 'hardcoded'
  elAsOf?: string   // date of the ethernodes snapshot used
  clEpochs?: [number, number]  // [startEpoch, endEpoch] window used
}

async function fetchCLShares(): Promise<{ shares: Record<string, number>; epochs: [number, number] }> {
  const statusRes = await withRetry(() =>
    fetch(`${BLOCKPRINT_API}/sync/status`).then(r => {
      if (!r.ok) { const e = Object.assign(new Error(`blockprint sync/status: ${r.status}`), { status: r.status }); throw e }
      return r.json() as Promise<{ greatest_block_slot: number }>
    })
  )

  const currentEpoch = Math.floor(statusRes.greatest_block_slot / 32)
  const startEpoch = currentEpoch - 1575  // ~7 days (1 epoch = ~6.4 min)

  const data = await withRetry(() =>
    fetch(`${BLOCKPRINT_API}/blocks_per_client/${startEpoch}/${currentEpoch}`).then(r => {
      if (!r.ok) { const e = Object.assign(new Error(`blockprint blocks_per_client: ${r.status}`), { status: r.status }); throw e }
      return r.json() as Promise<Record<string, number>>
    })
  )

  const total = Object.values(data).reduce((a, b) => a + b, 0)
  if (total === 0) throw new Error('blockprint returned zero blocks')

  const shares: Record<string, number> = {}
  for (const [name, id] of Object.entries(BLOCKPRINT_TO_ID)) {
    shares[id] = (data[name] ?? 0) / total
  }
  return { shares, epochs: [startEpoch, currentEpoch] }
}

interface EthernodesEntry {
  date: string
  data: {
    data: Array<{ client: string; value: number }>
  }
}

async function fetchELShares(): Promise<{ shares: Record<string, number>; asOf: string }> {
  const entries = await withRetry(() =>
    fetch(ETHERNODES_RAW_URL).then(r => {
      if (!r.ok) { const e = Object.assign(new Error(`ethernodes fetch: ${r.status}`), { status: r.status }); throw e }
      return r.json() as Promise<EthernodesEntry[]>
    })
  )

  const latest = entries[entries.length - 1]
  if (!latest) throw new Error('ethernodes data is empty')

  const clients = latest.data.data
  const total = clients.reduce((sum, c) => sum + c.value, 0)
  if (total === 0) throw new Error('ethernodes returned zero nodes')

  const shares: Record<string, number> = {}
  for (const { client, value } of clients) {
    const id = ETHERNODES_TO_ID[client.toLowerCase()]
    if (id) shares[id] = value / total
  }
  return { shares, asOf: latest.date }
}

export async function fetchNetworkShares(): Promise<NetworkShareResult> {
  let clShares: Record<string, number> = {}
  let clSource: NetworkShareResult['clSource'] = 'hardcoded'
  let clEpochs: [number, number] | undefined

  let elShares: Record<string, number> = {}
  let elSource: NetworkShareResult['elSource'] = 'hardcoded'
  let elAsOf: string | undefined

  try {
    const result = await fetchCLShares()
    clShares = result.shares
    clSource = 'blockprint'
    clEpochs = result.epochs
    console.log(`  CL shares from Blockprint (epochs ${clEpochs[0]}–${clEpochs[1]}):`,
      Object.entries(clShares).map(([id, v]) => `${id}=${(v * 100).toFixed(1)}%`).join(', '))
  } catch (err) {
    console.warn('  Could not fetch CL shares from Blockprint — falling back to hardcoded values:', (err as Error).message)
  }

  try {
    const result = await fetchELShares()
    elShares = result.shares
    elSource = 'ethernodes'
    elAsOf = result.asOf
    console.log(`  EL shares from Ethernodes (as of ${elAsOf}):`,
      Object.entries(elShares).map(([id, v]) => `${id}=${(v * 100).toFixed(1)}%`).join(', '))
  } catch (err) {
    console.warn('  Could not fetch EL shares from Ethernodes — falling back to hardcoded values:', (err as Error).message)
  }

  const shares = new Map<string, { el: number; cl: number }>()
  const allIds = new Set([...Object.keys(clShares), ...Object.keys(elShares)])
  for (const id of allIds) {
    shares.set(id, { el: elShares[id] ?? 0, cl: clShares[id] ?? 0 })
  }

  return { shares, elSource, clSource, elAsOf, clEpochs }
}
