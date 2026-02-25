const GITHUB_TOKEN = process.env.GITHUB_TOKEN

function githubHeaders(): HeadersInit {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set')
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Retry wrapper with exponential backoff; waits 60s on 429 (rate limit)
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e: any) {
      if (i === attempts - 1) throw e
      const wait = e?.status === 429 ? 60_000 : 2_000 * (i + 1)
      await sleep(wait)
    }
  }
  throw new Error('unreachable')
}

// Fetch raw file content from raw.githubusercontent.com — no auth, no rate limit, no 1MB cap
export async function fetchRaw(repo: string, ref: string, path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path}`
  return withRetry(async () => {
    const res = await fetch(url)
    if (!res.ok) {
      const err = new Error(`fetchRaw failed: ${res.status} ${url}`) as any
      err.status = res.status
      throw err
    }
    return res.text()
  })
}

// Get the latest release tag for a repo.
// First tries authenticated API; falls back to following the GitHub redirect
// (handles orgs with SAML SSO enforcement like NethermindEth).
export async function getLatestTag(repo: string): Promise<string> {
  const url = `https://api.github.com/repos/${repo}/releases/latest`
  const res = await fetch(url, { headers: githubHeaders() })

  if (res.ok) {
    const data = await res.json() as { tag_name: string }
    return data.tag_name
  }

  if (res.status === 403 || res.status === 401) {
    // Fall back: follow the HTML redirect to extract the tag from the URL
    const htmlUrl = `https://github.com/${repo}/releases/latest`
    const redirectRes = await fetch(htmlUrl, { redirect: 'manual' })
    const location = redirectRes.headers.get('location')
    if (location) {
      const match = location.match(/\/releases\/tag\/([^/]+)$/)
      if (match) return decodeURIComponent(match[1])
    }
  }

  throw new Error(`getLatestTag failed: ${res.status} ${repo}`)
}

// Search code in a repo — returns file paths matching the query
export async function searchCode(repo: string, query: string): Promise<string[]> {
  const encoded = encodeURIComponent(`${query} repo:${repo}`)
  const url = `https://api.github.com/search/code?q=${encoded}&per_page=30`
  return withRetry(async () => {
    const res = await fetch(url, {
      headers: {
        ...githubHeaders(),
        Accept: 'application/vnd.github.v3.text-match+json',
      },
    })
    if (res.status === 422) return []  // no results
    if (!res.ok) {
      const err = new Error(`searchCode failed: ${res.status} repo:${repo} q:${query}`) as any
      err.status = res.status
      throw err
    }
    const data = await res.json() as { items: Array<{ path: string }> }
    return data.items.map(i => i.path)
  })
}

export interface GitHubContentEntry {
  name: string
  path: string
  type: 'file' | 'dir' | 'submodule' | 'symlink'
  sha: string
  submodule_git_url?: string
}

// List directory contents via GitHub Contents API — returns entries including submodules with their pinned SHAs
export async function fetchDirContents(repo: string, ref: string, path: string): Promise<GitHubContentEntry[]> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${ref}`
  return withRetry(async () => {
    const res = await fetch(url, { headers: githubHeaders() })
    if (!res.ok) {
      const err = new Error(`fetchDirContents failed: ${res.status} ${url}`) as any
      err.status = res.status
      throw err
    }
    const data = await res.json()
    return Array.isArray(data) ? (data as GitHubContentEntry[]) : []
  })
}

// Fetch raw content of a specific file via GitHub API (used when raw.githubusercontent.com is insufficient)
export async function fetchViaApi(repo: string, ref: string, path: string): Promise<string> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${ref}`
  return withRetry(async () => {
    const res = await fetch(url, { headers: githubHeaders() })
    if (!res.ok) {
      const err = new Error(`fetchViaApi failed: ${res.status} ${url}`) as any
      err.status = res.status
      throw err
    }
    const data = await res.json() as { content: string; encoding: string }
    if (data.encoding === 'base64') {
      return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
    }
    return data.content
  })
}
