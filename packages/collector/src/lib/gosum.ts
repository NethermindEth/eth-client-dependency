import type { RawDep } from '../types.js'

// Parse go.sum into RawDep[].
// go.sum format: "module version hash" (two lines per module: the source zip and the go.mod hash).
// Skip /go.mod lines — these are integrity hashes for the module's go.mod file, not the source.
// All deps are treated as production (go.sum has no concept of dev/test deps).
export function parseGoSum(content: string, selfModule: string): RawDep[] {
  const deps: RawDep[] = []
  const seen = new Set<string>()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split(' ')
    if (parts.length < 3) continue

    const [mod, version] = parts
    if (!mod || !version) continue
    if (version.endsWith('/go.mod')) continue  // skip go.mod hash lines
    if (mod.startsWith(selfModule)) continue   // skip self-references

    const purl = `pkg:golang/${mod}@${version}`
    if (seen.has(purl)) continue
    seen.add(purl)

    deps.push({ name: mod, version, purl, isDev: false, depType: 'package' })
  }

  return deps
}

// Parse replace directives from go.mod.
// e.g. "github.com/old/pkg => github.com/new/pkg v1.0.0"
// Local path replacements (no version) are skipped — they're not meaningful as PURLs.
export function parseGoModReplacements(content: string): Map<string, string> {
  const replacements = new Map<string, string>()
  const replaceBlock = content.match(/replace\s*\(([^)]+)\)/s)?.[1] ?? ''
  const inlineReplace = [...content.matchAll(/^replace\s+(\S+)\s+=>\s+(\S+)\s+(\S+)/gm)]

  const lines = [
    ...replaceBlock.split('\n'),
    ...inlineReplace.map(m => `${m[1]} => ${m[2]} ${m[3]}`),
  ]

  for (const line of lines) {
    const match = line.trim().match(/^(\S+)(?:\s+\S+)?\s+=>\s+(\S+)\s+(\S+)/)
    if (match) {
      replacements.set(match[1], `${match[2]}@${match[3]}`)
    }
  }

  return replacements
}
