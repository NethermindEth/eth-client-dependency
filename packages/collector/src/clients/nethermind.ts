import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import { scanDllImport } from '../lib/search.js'
import type { ClientConfig, ClientResult, RawDep } from '../types.js'

// NuGet packages that are test/dev only — filter these out
const DEV_PACKAGE_PATTERNS = [
  /^FluentAssertions/i,
  /^BenchmarkDotNet/i,
  /^NUnit/i,
  /^xunit/i,
  /^Moq/i,
  /^Shouldly/i,
  /^Microsoft\.NET\.Test/i,
  /^coverlet/i,
]

function isDevPackage(name: string): boolean {
  return DEV_PACKAGE_PATTERNS.some(p => p.test(name))
}

// packages.lock.json entry for each resolved NuGet package
interface PackagesLockEntry {
  type: 'Direct' | 'Transitive' | 'Project'
  resolved?: string
  requested?: string
  contentHash?: string
}

interface PackagesLock {
  version: number
  dependencies: Record<string, Record<string, PackagesLockEntry>>
}

// Parse NuGet packages.lock.json — full transitive dep graph per target framework.
// Picks the framework target with the most resolved packages (usually net10.0).
// Skips Project-type entries (workspace references).
function parsePackagesLock(content: string): RawDep[] {
  const lock = JSON.parse(content) as PackagesLock
  const deps: RawDep[] = []
  const seen = new Set<string>()

  const frameworks = Object.values(lock.dependencies ?? {})
  if (frameworks.length === 0) return deps

  // Use the largest framework target — avoids picking a tiny test-only TFM
  const frameworkDeps = frameworks.reduce((best, cur) =>
    Object.keys(cur).length > Object.keys(best).length ? cur : best
  )

  for (const [name, entry] of Object.entries(frameworkDeps)) {
    if (entry.type === 'Project') continue   // workspace references
    const version = entry.resolved
    if (!version) continue

    const purl = `pkg:nuget/${name}@${version}`
    if (seen.has(purl)) continue
    seen.add(purl)

    deps.push({
      name,
      version,
      purl,
      isDev: isDevPackage(name),
      depType: 'package',
    })
  }

  return deps
}

// packages.lock.json path for Nethermind.Runner (the main executable project)
const PACKAGES_LOCK_PATH = 'src/Nethermind/Nethermind.Runner/packages.lock.json'

export async function collectNethermind(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)

  // Nethermind's NethermindEth org has SAML SSO on GitHub API — use raw.githubusercontent.com
  const lockContent = await fetchRaw(config.repo, tag, PACKAGES_LOCK_PATH)
  const packageDeps = parsePackagesLock(lockContent)
  const nativeDeps = await scanDllImport(config.repo, tag)

  return {
    client: config,
    scannedTag: tag,
    scannedAt: new Date().toISOString(),
    tagPinned: true,
    deps: [...packageDeps, ...nativeDeps],
    limitations: [],
  }
}
