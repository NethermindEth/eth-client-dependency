import { XMLParser } from 'fast-xml-parser'
import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import { scanJNI } from '../lib/search.js'
import type { ClientConfig, ClientResult, RawDep } from '../types.js'

interface VerificationComponent {
  '@_group': string
  '@_name': string
  '@_version': string
}

interface VerificationMetadata {
  'verification-metadata': {
    components: {
      component: VerificationComponent[]
    }
  }
}

// Maven group IDs that are test/benchmark/build-tooling — not runtime production deps
const TEST_GROUPS = new Set([
  'junit',
  'org.junit',
  'org.junit.jupiter',
  'org.junit.platform',
  'org.junit.vintage',
  'org.mockito',
  'org.assertj',
  'org.awaitility',
  'org.hamcrest',
  'org.openjdk.jmh',
  'org.openjdk.jol',
  'me.champeau.jmh',
  'com.github.spotbugs',
  // Gradle/build plugins
  'com.diffplug.spotless',
  'com.diffplug.durian',
  'com.jfrog.artifactory',
  'org.jacoco',
  'org.sonarqube',
  'org.graalvm.buildtools',
  'com.github.jk1.dependency-license-report',
  'de.undercouch.download',
  'net.ltgt.errorprone',
  'net.ltgt.gradle',
])

const TEST_GROUP_PREFIXES = ['org.sonarsource.', 'net.ltgt.']

function isTestGroup(group: string): boolean {
  if (TEST_GROUPS.has(group)) return true
  return TEST_GROUP_PREFIXES.some(p => group.startsWith(p))
}

// Parse gradle/verification-metadata.xml — contains all verified transitive deps
function parseVerificationMetadata(content: string): RawDep[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const parsed = parser.parse(content) as VerificationMetadata
  const components = parsed['verification-metadata']?.components?.component ?? []

  const deps: RawDep[] = []
  const seen = new Set<string>()

  for (const comp of components) {
    const group = comp['@_group']
    const name = comp['@_name']
    const version = comp['@_version']

    if (!group || !name || !version) continue

    // Skip javadoc and sources jars (not runtime deps)
    if (name.endsWith('-javadoc') || name.endsWith('-sources')) continue

    // Skip test frameworks, benchmarks, and Gradle build plugins
    if (isTestGroup(group)) continue

    const purl = `pkg:maven/${group}/${name}@${version}`
    if (seen.has(purl)) continue
    seen.add(purl)

    deps.push({ name: `${group}:${name}`, version, purl, isDev: false, depType: 'package' })
  }

  return deps
}

export async function collectBesu(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)
  const xmlContent = await fetchRaw(config.repo, tag, 'gradle/verification-metadata.xml')
  const packageDeps = parseVerificationMetadata(xmlContent)
  const nativeDeps = await scanJNI(config.repo, tag)

  return {
    client: config,
    scannedTag: tag,
    scannedAt: new Date().toISOString(),
    tagPinned: true,
    deps: [...packageDeps, ...nativeDeps],
    limitations: [],
  }
}
