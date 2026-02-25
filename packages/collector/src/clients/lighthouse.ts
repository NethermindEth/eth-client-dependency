import { parse as parseToml } from 'smol-toml'
import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import { resolveNativeLibs } from '../lib/cratesio.js'
import { collectCargoDevDeps } from '../lib/cargo.js'
import type { ClientConfig, ClientResult, RawDep } from '../types.js'

interface CargoLockPackage {
  name: string
  version: string
  source?: string
}

function parseCargoLock(content: string): CargoLockPackage[] {
  const parsed = parseToml(content) as { package?: CargoLockPackage[] }
  return parsed.package ?? []
}

export async function collectLighthouse(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)
  const [cargoLockContent, cargoTomlContent] = await Promise.all([
    fetchRaw(config.repo, tag, 'Cargo.lock'),
    fetchRaw(config.repo, tag, 'Cargo.toml'),
  ])

  const packages = parseCargoLock(cargoLockContent)
  const devDepNames = await collectCargoDevDeps(config.repo, tag, cargoTomlContent)

  const packageDeps: RawDep[] = packages
    .filter(pkg => pkg.source != null)
    .map(pkg => ({
      name: pkg.name,
      version: pkg.version,
      purl: `pkg:cargo/${pkg.name}@${pkg.version}`,
      isDev: devDepNames.has(pkg.name),
      depType: 'package' as const,
    }))

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
    limitations: [],
  }
}
