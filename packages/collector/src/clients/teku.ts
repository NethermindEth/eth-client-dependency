import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import { scanJNI } from '../lib/search.js'
import type { ClientConfig, ClientResult, RawDep } from '../types.js'

// Test-only scopes in Gradle — exclude these
const DEV_SCOPES = ['testImplementation', 'testRuntimeOnly', 'testCompileOnly', 'testFixturesImplementation']

// Parse gradle/versions.gradle — Teku's centralized version management file
// Two patterns:
//   dependency 'group:artifact:version'
//   dependencySet(group: 'group', version: 'ver') { entry 'artifact' }
function parseVersionsGradle(content: string): RawDep[] {
  const deps: RawDep[] = []
  const seen = new Set<string>()

  // Detect if a line is inside a dev scope block
  // Simple heuristic: skip entries from known test dependency blocks
  const isTestScope = DEV_SCOPES.some(scope => content.includes(scope))
  void isTestScope  // versions.gradle doesn't have scope info — all entries are version declarations

  // Pattern 1: dependency 'group:artifact:version'
  const singleMatches = content.matchAll(/dependency\s+'([^:]+):([^:]+):([^']+)'/g)
  for (const match of singleMatches) {
    const [, group, artifact, version] = match
    const purl = `pkg:maven/${group}/${artifact}@${version}`
    if (seen.has(purl)) continue
    seen.add(purl)
    deps.push({ name: `${group}:${artifact}`, version, purl, isDev: false, depType: 'package' })
  }

  // Pattern 2: dependencySet(group: 'group', version: 'ver') { entry 'artifact' ... }
  const setMatches = content.matchAll(/dependencySet\s*\(\s*group\s*:\s*'([^']+)',\s*version\s*:\s*'([^']+)'\s*\)\s*\{([^}]+)\}/gs)
  for (const match of setMatches) {
    const [, group, version, block] = match
    const entries = block.matchAll(/entry\s+'([^']+)'/g)
    for (const entry of entries) {
      const artifact = entry[1]
      const purl = `pkg:maven/${group}/${artifact}@${version}`
      if (seen.has(purl)) continue
      seen.add(purl)
      deps.push({ name: `${group}:${artifact}`, version, purl, isDev: false, depType: 'package' })
    }
  }

  return deps
}

export async function collectTeku(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)
  const versionsGradle = await fetchRaw(config.repo, tag, 'gradle/versions.gradle')
  const packageDeps = parseVersionsGradle(versionsGradle)
  const nativeDeps = await scanJNI(config.repo)

  return {
    client: config,
    scannedTag: tag,
    scannedAt: new Date().toISOString(),
    tagPinned: true,
    deps: [...packageDeps, ...nativeDeps],
    limitations: [
      'Direct dependencies only — no Gradle lock file exists in repo',
      'Transitive deps not resolved',
    ],
  }
}
