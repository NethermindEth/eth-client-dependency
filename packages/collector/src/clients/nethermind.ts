import { XMLParser } from 'fast-xml-parser'
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

interface PackageVersionElement {
  '@_Include': string
  '@_Version': string
}

interface DirectoryPackagesProps {
  Project: {
    ItemGroup: Array<{
      PackageVersion?: PackageVersionElement[]
    }> | {
      PackageVersion?: PackageVersionElement[]
    }
  }
}

// Parse Directory.Packages.props — NuGet central package management
function parseDirectoryPackagesProps(content: string): RawDep[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['ItemGroup', 'PackageVersion'].includes(name),
  })
  const parsed = parser.parse(content) as DirectoryPackagesProps
  const deps: RawDep[] = []
  const seen = new Set<string>()

  const project = parsed.Project
  if (!project) return deps

  const itemGroups = Array.isArray(project.ItemGroup) ? project.ItemGroup : [project.ItemGroup]

  for (const group of itemGroups) {
    const packages = group?.PackageVersion ?? []
    for (const pkg of packages) {
      const name = pkg['@_Include']
      const version = pkg['@_Version']
      if (!name || !version) continue

      // Strip version range brackets e.g. [7.2.0]
      const cleanVersion = version.replace(/^\[|\]$/g, '')
      const purl = `pkg:nuget/${name}@${cleanVersion}`
      if (seen.has(purl)) continue
      seen.add(purl)

      deps.push({
        name,
        version: cleanVersion,
        purl,
        isDev: isDevPackage(name),
        depType: 'package',
      })
    }
  }

  return deps
}

export async function collectNethermind(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)

  // Nethermind's NethermindEth org has SAML SSO on GitHub API — use raw.githubusercontent.com
  const propsContent = await fetchRaw(config.repo, tag, 'Directory.Packages.props')
  const packageDeps = parseDirectoryPackagesProps(propsContent)
  const nativeDeps = await scanDllImport(config.repo, tag)

  return {
    client: config,
    scannedTag: tag,
    scannedAt: new Date().toISOString(),
    tagPinned: true,
    deps: [...packageDeps, ...nativeDeps],
    limitations: [
      'Direct dependencies only — no packages.lock.json exists in repo',
      'Transitive deps not resolved',
    ],
  }
}
