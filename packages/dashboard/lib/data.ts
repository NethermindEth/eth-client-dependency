export type Layer = 'EL' | 'CL'
export type Ecosystem = 'go' | 'rust' | 'typescript' | 'java' | 'dotnet' | 'nim'
export type DepType = 'package' | 'native'

export interface ClientMeta {
  id: string
  name: string
  repo: string
  layer: Layer
  ecosystem: Ecosystem
  elNetworkShare: number
  clNetworkShare: number
  scannedTag: string
  scannedAt: string
  tagPinned: boolean
  limitations: string[]
}

export interface Dep {
  purl: string
  name: string
  version: string
  ecosystem: string
  depType: DepType
  canonicalId?: string
}

export interface FrequencyEntry {
  clients: string[]
  elCoverage: number
  clCoverage: number
  isCrossLayer: boolean
  canonicalId?: string
}

export interface DepsData {
  generatedAt: string
  clients: ClientMeta[]
  deps: Record<string, Dep[]>
  frequency: Record<string, FrequencyEntry>
}

// In dev, fall back to local file. In production, fetch from GitHub.
const DATA_URL =
  process.env.NEXT_PUBLIC_DATA_URL ??
  'https://raw.githubusercontent.com/your-org/eth-dependency/main/data/deps.json'

export async function getDepsData(): Promise<DepsData> {
  // In development, try to read local file first
  if (process.env.NODE_ENV === 'development') {
    try {
      const { readFile } = await import('fs/promises')
      const { join } = await import('path')
      const localPath = join(process.cwd(), '../../data/deps.json')
      const content = await readFile(localPath, 'utf-8')
      return JSON.parse(content) as DepsData
    } catch {
      // fall through to fetch
    }
  }

  const res = await fetch(DATA_URL, {
    next: { revalidate: 3600 }, // revalidate every hour
  })
  if (!res.ok) throw new Error(`Failed to fetch deps data: ${res.status}`)
  return res.json() as Promise<DepsData>
}

