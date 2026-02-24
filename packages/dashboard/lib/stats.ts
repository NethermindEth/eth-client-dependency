import type { DepsData, FrequencyEntry } from './data'

// Maps PURL type to human-readable ecosystem label
const PURL_ECO_MAP: Record<string, string> = {
  golang: 'go',
  cargo: 'rust',
  maven: 'java',
  nuget: 'dotnet',
  npm: 'npm',
  github: 'nim',
}

function purlToName(purl: string): string {
  // Strip pkg:type/ prefix and @version suffix
  const path = purl
    .replace(/^pkg:[^/]+\//, '')
    .replace(/@[^@/]*$/, '')
    .replace(/%40/g, '@')
  const parts = path.split('/')
  // If last segment is a Go major version suffix (v2, v3...) include parent segments
  if (parts.length >= 2 && /^v\d+$/.test(parts[parts.length - 1])) {
    return parts.slice(Math.max(0, parts.length - 3)).join('/')
  }
  // Take last 2 segments (org/repo style), or just the name if shorter
  return parts.slice(Math.max(0, parts.length - 2)).join('/')
}

function purlToEcosystem(purl: string): string {
  const type = purl.split(':')[1]?.split('/')[0] ?? 'unknown'
  return PURL_ECO_MAP[type] ?? type
}

export function getTopSharedDeps(
  data: DepsData,
  limit = 50,
): Array<FrequencyEntry & { purl: string; name: string; ecosystem: string }> {
  return Object.entries(data.frequency)
    .map(([purl, entry]) => ({
      purl,
      name: purlToName(purl),
      ecosystem: purlToEcosystem(purl),
      ...entry,
    }))
    .filter(e => e.clients.length >= 2)
    .sort((a, b) => b.clients.length - a.clients.length || b.elCoverage + b.clCoverage - (a.elCoverage + a.clCoverage))
    .slice(0, limit)
}

export function getEcosystemStats(data: DepsData): Record<string, { clients: string[]; sharedDeps: number; totalDeps: number }> {
  const stats: Record<string, { clients: string[]; sharedDeps: number; totalDeps: number }> = {}

  // Build client → ecosystem lookup once (O(n))
  const clientEco = new Map<string, string>()
  for (const client of data.clients) {
    const eco = client.ecosystem
    clientEco.set(client.id, eco)
    if (!stats[eco]) stats[eco] = { clients: [], sharedDeps: 0, totalDeps: 0 }
    stats[eco].clients.push(client.id)
  }

  for (const [, entry] of Object.entries(data.frequency)) {
    // Count clients per ecosystem for this dep (O(clients per dep), not O(all deps))
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
