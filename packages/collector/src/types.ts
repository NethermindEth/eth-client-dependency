export type Layer = 'EL' | 'CL'
export type Ecosystem = 'go' | 'rust' | 'typescript' | 'java' | 'dotnet' | 'nim'
export type DepType = 'package' | 'native'

export interface ClientConfig {
  id: string
  name: string
  repo: string        // owner/repo
  layer: Layer
  ecosystem: Ecosystem
  elNetworkShare: number  // fraction of EL nodes (0 if CL only)
  clNetworkShare: number  // fraction of CL validators (0 if EL only)
}

export interface RawDep {
  name: string
  version: string
  purl: string
  isDev: boolean
  depType: DepType
  nativeLib?: string  // underlying C lib name for native deps
}

export interface ClientResult {
  client: ClientConfig
  scannedTag: string
  scannedAt: string
  tagPinned: boolean  // false if SBOM API (HEAD-based)
  deps: RawDep[]
  limitations: string[]
}

export interface NormalizedDep {
  purl: string
  name: string
  version: string
  ecosystem: string
  depType: DepType
  canonicalId?: string
}

export interface FrequencyEntry {
  clients: string[]
  elCoverage: number    // fraction of EL network
  clCoverage: number    // fraction of CL network
  isCrossLayer: boolean
  canonicalId?: string
}

export interface DepsOutput {
  generatedAt: string
  clients: Array<ClientConfig & {
    scannedTag: string
    scannedAt: string
    tagPinned: boolean
    limitations: string[]
  }>
  deps: Record<string, NormalizedDep[]>
  frequency: Record<string, FrequencyEntry>
  failedClients: Array<{ id: string; error: string }>
  networkSharesSource: {
    elSource: 'ethernodes' | 'hardcoded'
    clSource: 'blockprint' | 'hardcoded'
    elAsOf?: string
    clEpochs?: [number, number]
  }
}
