import { parse as parseToml } from 'smol-toml'
import { fetchRaw } from './fetch.js'

interface MemberCargoToml {
  'dev-dependencies'?: Record<string, unknown>
}

interface RootCargoToml {
  'dev-dependencies'?: Record<string, unknown>
  workspace?: {
    members?: string[]
    'dev-dependencies'?: Record<string, unknown>
  }
}

// Collect all dev-dependency names from a Cargo workspace:
// reads the root Cargo.toml plus every workspace member's Cargo.toml.
// Promise.allSettled ensures individual member fetch failures don't abort the run.
export async function collectCargoDevDeps(
  repo: string,
  tag: string,
  rootContent: string,
): Promise<Set<string>> {
  const devDeps = new Set<string>()
  const root = parseToml(rootContent) as RootCargoToml

  // Root-level and workspace-level dev deps
  for (const name of Object.keys(root['dev-dependencies'] ?? {})) devDeps.add(name)
  for (const name of Object.keys(root.workspace?.['dev-dependencies'] ?? {})) devDeps.add(name)

  // Workspace member dev deps — fetch all member Cargo.toml files in parallel
  const members = (root.workspace?.members ?? [])
    .map(p => p.replace(/\/\*$/, '').replace(/\/$/, '').trim())
    .filter(p => p.length > 0 && !/[*?]/.test(p))  // skip glob entries

  const results = await Promise.allSettled(
    members.map(async (memberPath) => {
      const content = await fetchRaw(repo, tag, `${memberPath}/Cargo.toml`)
      const member = parseToml(content) as MemberCargoToml
      for (const name of Object.keys(member['dev-dependencies'] ?? {})) {
        devDeps.add(name)
      }
    })
  )

  const failed = results.filter(r => r.status === 'rejected').length
  if (failed > 0) {
    console.warn(
      `  [${repo}] ${failed}/${members.length} workspace member Cargo.toml fetches failed — dev dep filtering may be incomplete`
    )
  }

  return devDeps
}
