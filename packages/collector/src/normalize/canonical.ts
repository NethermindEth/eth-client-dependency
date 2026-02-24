import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

interface CanonicalLib {
  description: string
  category: string
  purls: string[]
  native_names?: string[]
}

interface CanonicalConfig {
  libraries: Record<string, CanonicalLib>
}

let _config: CanonicalConfig | null = null

function loadConfig(): CanonicalConfig {
  if (_config) return _config
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const mappingsPath = join(__dirname, '../../../../mappings/canonical.yaml')
  const content = readFileSync(mappingsPath, 'utf-8')
  _config = yaml.load(content) as CanonicalConfig
  return _config
}

// Build reverse lookup: purl/native_name → canonicalId
function buildIndex(): Map<string, string> {
  const config = loadConfig()
  const index = new Map<string, string>()
  for (const [id, lib] of Object.entries(config.libraries)) {
    for (const purl of lib.purls) index.set(purl, id)
    for (const name of lib.native_names ?? []) index.set(name, id)
  }
  return index
}

let _index: Map<string, string> | null = null

export function lookupCanonical(purlOrNativeName: string): string | undefined {
  if (!_index) _index = buildIndex()
  // Try exact match first, then strip @version suffix (canonical.yaml stores unversioned PURLs)
  const unversioned = purlOrNativeName.replace(/@[^@]+$/, '')
  return _index.get(purlOrNativeName) ?? _index.get(unversioned)
}

export function getCanonicalLibs(): Record<string, CanonicalLib> {
  return loadConfig().libraries
}
