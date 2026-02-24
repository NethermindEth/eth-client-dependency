import { sleep } from './fetch.js'

interface CratesIoEntry {
  name: string
  vers: string
  links: string | null
}

function cratesIoIndexPath(name: string): string {
  const n = name.toLowerCase()
  if (n.length === 1) return `1/${n}`
  if (n.length === 2) return `2/${n}`
  if (n.length === 3) return `3/${n[0]}/${n}`
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n}`
}

export async function getNativeLink(crateName: string, version: string): Promise<string | null> {
  const path = cratesIoIndexPath(crateName)
  const url = `https://index.crates.io/${path}`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'eth-dependency-dashboard/0.1 (github.com/eth-supply-chain)' },
  })

  if (!res.ok) return null

  const text = await res.text()
  const lines = text.trim().split('\n')

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as CratesIoEntry
      if (entry.vers === version && entry.links) {
        return entry.links
      }
    } catch {
      // skip malformed lines
    }
  }

  return null
}

// Resolve native library names for a list of -sys crates
export async function resolveNativeLibs(
  sysCrates: Array<{ name: string; version: string }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  for (const crate of sysCrates) {
    await sleep(1100)  // crates.io rate limit: 1 req/sec
    const link = await getNativeLink(crate.name, crate.version)
    if (link) result.set(crate.name, link)
  }

  return result
}
