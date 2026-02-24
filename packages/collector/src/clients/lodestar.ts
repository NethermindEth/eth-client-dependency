import yaml from 'js-yaml'
import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import type { ClientConfig, ClientResult, RawDep } from '../types.js'

// pnpm lockfile v9 structure
interface PnpmLockV9 {
  lockfileVersion: string
  importers?: Record<string, {
    dependencies?: Record<string, { specifier: string; version: string }>
    devDependencies?: Record<string, { specifier: string; version: string }>
    optionalDependencies?: Record<string, { specifier: string; version: string }>
  }>
  packages?: Record<string, {
    resolution?: { integrity?: string }
    engines?: Record<string, string>
    deprecated?: string
  }>
  snapshots?: Record<string, {
    dependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    dev?: boolean
  }>
}

function parsePnpmLockV9(content: string): RawDep[] {
  const lock = yaml.load(content) as PnpmLockV9
  const deps: RawDep[] = []
  const seen = new Set<string>()

  // Collect all dev dep names from all importers
  const devPkgKeys = new Set<string>()
  if (lock.importers) {
    for (const importer of Object.values(lock.importers)) {
      for (const [name, info] of Object.entries(importer.devDependencies ?? {})) {
        // pnpm v9 version key format: "name@version"
        devPkgKeys.add(`${name}@${info.version}`)
      }
    }
  }

  // All packages from the packages section
  for (const key of Object.keys(lock.packages ?? {})) {
    // key format: "@scope/name@version" or "name@version"
    const match = key.match(/^(@[^@]+\/[^@]+|[^@]+)@(.+)$/)
    if (!match) continue

    const [, name, version] = match
    const isDev = devPkgKeys.has(`${name}@${version}`)
    const purl = name.startsWith('@')
      ? `pkg:npm/${name}@${version}`
      : `pkg:npm/${name}@${version}`

    if (seen.has(purl)) continue
    seen.add(purl)

    deps.push({ name, version, purl, isDev, depType: 'package' })
  }

  return deps
}

export async function collectLodestar(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)
  const lockContent = await fetchRaw(config.repo, tag, 'pnpm-lock.yaml')
  const deps = parsePnpmLockV9(lockContent)

  return {
    client: config,
    scannedTag: tag,
    scannedAt: new Date().toISOString(),
    tagPinned: true,
    deps,
    limitations: [
      'Dev dep classification is approximate for transitive deps',
    ],
  }
}
