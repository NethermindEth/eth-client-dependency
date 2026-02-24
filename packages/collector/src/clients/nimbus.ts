import { fetchRaw, getLatestTag } from '../lib/fetch.js'
import type { ClientConfig, ClientResult, RawDep } from '../types.js'

interface Submodule {
  path: string
  url: string
  branch?: string
}

// Parse .gitmodules file — Nimbus vendors all deps as git submodules
// Format:
//   [submodule "vendor/nim-blscurve"]
//     path = vendor/nim-blscurve
//     url = https://github.com/status-im/nim-blscurve.git
function parseGitModules(content: string): Submodule[] {
  const submodules: Submodule[] = []
  const blocks = content.split(/^\[submodule/m).slice(1)

  for (const block of blocks) {
    const path = block.match(/path\s*=\s*(.+)/)?.[1]?.trim()
    const url = block.match(/url\s*=\s*(.+)/)?.[1]?.trim()
    const branch = block.match(/branch\s*=\s*(.+)/)?.[1]?.trim()

    if (path && url) {
      submodules.push({ path, url, branch })
    }
  }

  return submodules
}

// Convert a git URL to a PURL
// e.g. https://github.com/status-im/nim-blscurve.git -> pkg:github/status-im/nim-blscurve
function urlToPurl(url: string, path: string): string {
  const githubMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
  if (githubMatch) {
    return `pkg:github/${githubMatch[1]}/${githubMatch[2]}`
  }
  // fallback: use the path basename
  const name = path.split('/').pop() ?? path
  return `pkg:generic/${name}`
}

function submoduleToName(path: string): string {
  return path.split('/').pop() ?? path
}

// Skip non-library submodules — test fixtures, network configs
const SKIP_PATH_PREFIXES = [
  'vendor/mainnet',
  'vendor/nim-eth2-scenarios',
  'vendor/gnosis',
  'vendor/sepolia',
  'vendor/holesky',
]

export async function collectNimbus(config: ClientConfig): Promise<ClientResult> {
  const tag = await getLatestTag(config.repo)
  const gitModulesContent = await fetchRaw(config.repo, tag, '.gitmodules')
  const submodules = parseGitModules(gitModulesContent)

  const deps: RawDep[] = submodules
    .filter(s => !SKIP_PATH_PREFIXES.some(prefix => s.path.startsWith(prefix)))
    .map(s => ({
      name: submoduleToName(s.path),
      version: s.branch ?? 'master',
      purl: urlToPurl(s.url, s.path),
      isDev: false,
      depType: 'package' as const,
    }))

  return {
    client: config,
    scannedTag: tag,
    scannedAt: new Date().toISOString(),
    tagPinned: true,
    deps,
    limitations: [
      'Direct dependencies only — Nim ecosystem uses git submodules, no transitive resolution',
      'Version is tracking branch name, not pinned commit hash',
    ],
  }
}
