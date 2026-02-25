import { searchCode, fetchRaw, sleep } from './fetch.js'
import type { RawDep } from '../types.js'

// Scan Go source for #cgo directives — detects vendored C libraries
export async function scanCGO(repo: string, tag: string): Promise<RawDep[]> {
  const files = await searchCode(repo, 'import "C"')

  const nativeDeps: RawDep[] = []
  const seen = new Set<string>()

  for (const filePath of files) {
    await sleep(500)
    try {
      const content = await fetchRaw(repo, tag, filePath)
      const cgoMatches = content.match(/#cgo\s+\w+:\s+.+/g) ?? []

      for (const directive of cgoMatches) {
        // Extract library names from -I (include) paths and -l (link) flags
        const includeMatch = directive.match(/-I[./]*([a-zA-Z0-9_-]+)/g)
        const linkMatch = directive.match(/-l([a-zA-Z0-9_-]+)/g)

        const libs = [
          ...(includeMatch ?? []).map(m => m.replace(/-I[./]*/, '')),
          ...(linkMatch ?? []).map(m => m.replace(/-l/, '')),
        ]

        for (const lib of libs) {
          if (!seen.has(lib)) {
            seen.add(lib)
            nativeDeps.push({
              name: lib,
              version: 'vendored',
              purl: `pkg:generic/${lib}`,
              isDev: false,
              depType: 'native',
              nativeLib: lib,
            })
          }
        }
      }
    } catch (err) {
      console.warn(`  [scanCGO] failed to fetch ${filePath} from ${repo}:`, err)
    }
  }

  return nativeDeps
}

// Scan Java source for System.loadLibrary() calls
export async function scanJNI(repo: string, tag: string): Promise<RawDep[]> {
  const files = await searchCode(repo, 'System.loadLibrary')

  const nativeDeps: RawDep[] = []
  const seen = new Set<string>()

  for (const filePath of files) {
    await sleep(500)
    try {
      const content = await fetchRaw(repo, tag, filePath)
      const matches = content.match(/System\.loadLibrary\("([^"]+)"\)/g) ?? []
      for (const match of matches) {
        const lib = match.match(/"([^"]+)"/)?.[1]
        if (lib && !seen.has(lib)) {
          seen.add(lib)
          nativeDeps.push({
            name: lib,
            version: 'runtime',
            purl: `pkg:generic/${lib}`,
            isDev: false,
            depType: 'native',
            nativeLib: lib,
          })
        }
      }
    } catch {
      // skip
    }
  }

  return nativeDeps
}

// OS/system libraries — always present, not meaningful external deps.
// Used both at scan time (scanDllImport) and at aggregation time (computeNativeDeps in index.ts).
export const SYSTEM_LIBS = new Set([
  'kernel32.dll', 'kernel32', 'ntdll.dll', 'ntdll',
  'user32.dll', 'user32', 'advapi32.dll', 'advapi32',
  'ole32.dll', 'ole32', 'oleaut32.dll', 'oleaut32',
  'ws2_32.dll', 'ws2_32', 'wininet.dll', 'wininet',
  'shell32.dll', 'shell32', 'shlwapi.dll', 'shlwapi',
  'msvcrt.dll', 'msvcrt', 'ucrtbase.dll', 'ucrtbase',
  'libc', 'libm', 'libdl', 'libpthread', 'libstdc++',
])

// Scan C# source for [DllImport] / [LibraryImport] attributes
export async function scanDllImport(repo: string, tag: string): Promise<RawDep[]> {
  const files = await searchCode(repo, 'DllImport')

  const nativeDeps: RawDep[] = []
  const seen = new Set<string>()

  for (const filePath of files.filter(f => f.endsWith('.cs'))) {
    await sleep(500)
    try {
      const content = await fetchRaw(repo, tag, filePath)
      // Match [DllImport("libname")] and [LibraryImport("libname")]
      const matches = content.match(/\[(?:Dll|Library)Import\("([^"]+)"\)/g) ?? []
      for (const match of matches) {
        const lib = match.match(/"([^"]+)"/)?.[1]
        if (lib && !seen.has(lib) && !SYSTEM_LIBS.has(lib.toLowerCase())) {
          seen.add(lib)
          nativeDeps.push({
            name: lib,
            version: 'runtime',
            purl: `pkg:generic/${lib}`,
            isDev: false,
            depType: 'native',
            nativeLib: lib,
          })
        }
      }
    } catch {
      // skip
    }
  }

  return nativeDeps
}
