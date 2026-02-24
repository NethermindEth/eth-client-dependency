import { readFileSync } from 'fs'
import { join } from 'path'
import { load } from 'js-yaml'

interface CanonicalLib {
  purls?: string[]
  native_names?: string[]
}

interface CanonicalConfig {
  libraries: Record<string, CanonicalLib>
}

let _nativeIndex: Map<string, string> | null = null

export function lookupNativeCanonical(nativeName: string): string | undefined {
  if (!_nativeIndex) {
    try {
      // canonical.yaml lives at the repo root, two levels above packages/dashboard
      const content = readFileSync(join(process.cwd(), '../../mappings/canonical.yaml'), 'utf-8')
      const config = load(content) as CanonicalConfig
      _nativeIndex = new Map()
      for (const [id, lib] of Object.entries(config.libraries)) {
        for (const name of lib.native_names ?? []) {
          _nativeIndex.set(name, id)
        }
        for (const purl of lib.purls ?? []) {
          // Index both versioned and unversioned forms
          _nativeIndex.set(purl, id)
          const unversioned = purl.replace(/@[^@]+$/, '')
          if (unversioned !== purl) _nativeIndex.set(unversioned, id)
        }
      }
    } catch {
      _nativeIndex = new Map()
    }
  }
  // Try exact match, then strip @version suffix
  const unversioned = nativeName.replace(/@[^@]+$/, '')
  return _nativeIndex.get(nativeName) ?? _nativeIndex.get(unversioned)
}
