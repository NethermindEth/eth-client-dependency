// Normalize a PURL to a consistent format
export function normalizePurl(purl: string): string {
  try {
    // lowercase the type and namespace, preserve name case for ecosystems that care
    const match = purl.match(/^pkg:([^/]+)\/(.+)$/)
    if (!match) return purl.toLowerCase()
    const [, type, rest] = match
    return `pkg:${type.toLowerCase()}/${rest}`
  } catch {
    return purl
  }
}

// Build a PURL from components
export function buildPurl(type: string, namespace: string | null, name: string, version: string): string {
  const ns = namespace ? `${namespace}/` : ''
  return `pkg:${type}/${ns}${name}@${version}`
}

// Extract name from a PURL
export function purlName(purl: string): string {
  const match = purl.match(/^pkg:[^/]+\/(?:.+\/)?([^@]+)@/)
  return match?.[1] ?? purl
}

// Extract version from a PURL
export function purlVersion(purl: string): string {
  const match = purl.match(/@(.+)$/)
  return match?.[1] ?? 'unknown'
}

// Extract ecosystem type from a PURL
export function purlEcosystem(purl: string): string {
  const match = purl.match(/^pkg:([^/]+)\//)
  return match?.[1] ?? 'unknown'
}
