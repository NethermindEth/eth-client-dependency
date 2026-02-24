import { searchCode, fetchRaw, sleep } from './fetch.js'
import type { RawDep } from '../types.js'

// Scan Go source for #cgo directives — detects vendored C libraries
export async function scanCGO(repo: string, tag: string): Promise<RawDep[]> {
  await sleep(2000)  // GitHub Search: 30 req/min
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
    } catch {
      // file fetch failed — skip
    }
  }

  return nativeDeps
}

// Scan Java source for System.loadLibrary() calls
export async function scanJNI(repo: string): Promise<RawDep[]> {
  await sleep(2000)
  const files = await searchCode(repo, 'System.loadLibrary')

  const nativeDeps: RawDep[] = []
  const seen = new Set<string>()

  for (const filePath of files) {
    await sleep(500)
    try {
      const content = await fetchRaw(repo, 'HEAD', filePath)
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

// Scan C# source for [DllImport] / [LibraryImport] attributes
export async function scanDllImport(repo: string): Promise<RawDep[]> {
  await sleep(2000)
  const files = await searchCode(repo, 'DllImport')

  const nativeDeps: RawDep[] = []
  const seen = new Set<string>()

  for (const filePath of files.filter(f => f.endsWith('.cs'))) {
    await sleep(500)
    try {
      const content = await fetchRaw(repo, 'HEAD', filePath)
      // Match [DllImport("libname")] and [LibraryImport("libname")]
      const matches = content.match(/\[(?:Dll|Library)Import\("([^"]+)"\)/g) ?? []
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
