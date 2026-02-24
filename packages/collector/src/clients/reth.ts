import { parse as parseToml } from 'smol-toml'
import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import { resolveNativeLibs } from '../lib/cratesio.js'
import type { ClientConfig, ClientResult, RawDep } from '../types.js'

interface CargoLockPackage {
  name: string
  version: string
  source?: string
  dependencies?: string[]
}

interface CargoToml {
  'dev-dependencies'?: Record<string, unknown>
  workspace?: {
    'dev-dependencies'?: Record<string, unknown>
  }
}

function parseCargoLock(content: string): CargoLockPackage[] {
  const parsed = parseToml(content) as { package?: CargoLockPackage[] }
  return parsed.package ?? []
}

function parseDevDeps(cargoTomlContent: string): Set<string> {
  const parsed = parseToml(cargoTomlContent) as CargoToml
  const devDeps = new Set<string>()

  const direct = parsed['dev-dependencies'] ?? {}
  const workspace = parsed.workspace?.['dev-dependencies'] ?? {}

  for (const name of [...Object.keys(direct), ...Object.keys(workspace)]) {
    devDeps.add(name)
  }

  return devDeps
}

export async function collectReth(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)
  const [cargoLockContent, cargoTomlContent] = await Promise.all([
    fetchRaw(config.repo, tag, 'Cargo.lock'),
    fetchRaw(config.repo, tag, 'Cargo.toml'),
  ])

  const packages = parseCargoLock(cargoLockContent)
  const devDepNames = parseDevDeps(cargoTomlContent)

  const packageDeps: RawDep[] = packages
    .filter(pkg => pkg.source != null)  // exclude workspace members (source is null)
    .map(pkg => ({
      name: pkg.name,
      version: pkg.version,
      purl: `pkg:cargo/${pkg.name}@${pkg.version}`,
      isDev: devDepNames.has(pkg.name),
      depType: 'package' as const,
    }))

  // Resolve native libs from -sys crates
  const sysCrates = packageDeps
    .filter(d => !d.isDev && d.name.endsWith('-sys'))
    .map(d => ({ name: d.name, version: d.version }))

  const nativeLibMap = await resolveNativeLibs(sysCrates)

  const nativeDeps: RawDep[] = []
  for (const [crateName, nativeLib] of nativeLibMap) {
    const crate = packageDeps.find(d => d.name === crateName)
    if (crate) {
      nativeDeps.push({
        name: nativeLib,
        version: crate.version,
        purl: `pkg:generic/${nativeLib}`,
        isDev: false,
        depType: 'native',
        nativeLib,
      })
    }
  }

  return {
    client: config,
    scannedTag: tag,
    scannedAt: new Date().toISOString(),
    tagPinned: true,
    deps: [...packageDeps, ...nativeDeps],
    limitations: [
      'Cargo.lock dev dep filtering is approximate — workspace-level dev deps only',
    ],
  }
}
