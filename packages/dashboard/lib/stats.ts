import type { DepsData, FrequencyEntry } from './data'

export function getTopSharedDeps(
  data: DepsData,
  limit = 50,
): Array<FrequencyEntry & { purl: string; name: string; ecosystem: string }> {
  return Object.entries(data.frequency)
    .map(([purl, entry]) => ({
      purl,
      name: purl.split('/').pop()?.split('@')[0] ?? purl,
      ecosystem: purl.split(':')[1]?.split('/')[0] ?? 'unknown',
      ...entry,
    }))
    .filter(e => e.clients.length >= 2)
    .sort((a, b) => b.clients.length - a.clients.length || b.elCoverage + b.clCoverage - (a.elCoverage + a.clCoverage))
    .slice(0, limit)
}

export function getEcosystemStats(data: DepsData): Record<string, { clients: string[]; sharedDeps: number; totalDeps: number }> {
  const stats: Record<string, { clients: string[]; sharedDeps: number; totalDeps: number }> = {}

  for (const client of data.clients) {
    const eco = client.ecosystem
    if (!stats[eco]) stats[eco] = { clients: [], sharedDeps: 0, totalDeps: 0 }
    stats[eco].clients.push(client.id)
  }

  for (const [, entry] of Object.entries(data.frequency)) {
    const clientEcos = entry.clients.map(id => data.clients.find(c => c.id === id)?.ecosystem)
    const uniqueEcos = [...new Set(clientEcos.filter(Boolean))]

    for (const eco of uniqueEcos) {
      if (!eco || !stats[eco]) continue
      stats[eco].totalDeps++
      const ecoClients = entry.clients.filter(id => data.clients.find(c => c.id === id)?.ecosystem === eco)
      if (ecoClients.length >= 2) stats[eco].sharedDeps++
    }
  }

  return stats
}
