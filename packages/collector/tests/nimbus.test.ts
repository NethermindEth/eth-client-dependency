import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { collectNimbus } from '../src/clients/nimbus.js'

process.env.GITHUB_TOKEN ??= 'fixture-token'

const config = {
  id: 'nimbus',
  name: 'Nimbus',
  repo: 'status-im/nimbus-eth2',
  layer: 'CL' as const,
  ecosystem: 'nim' as const,
  elNetworkShare: 0,
  clNetworkShare: 0.3,
}

const gitmodules = `[submodule "vendor/nim-blscurve"]
  path = vendor/nim-blscurve
  url = https://github.com/status-im/nim-blscurve.git
  branch = master
`

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function useGitHubFixtures(vendorEntries: unknown[]) {
  globalThis.fetch = async (input: any) => {
    const url = String(input)
    if (url.endsWith('/releases/latest')) {
      return new Response(JSON.stringify({ tag_name: 'v26.9.1' }), { status: 200 })
    }
    if (url.endsWith('/v26.9.1/.gitmodules')) {
      return new Response(gitmodules, { status: 200 })
    }
    if (url.includes('/contents/vendor?ref=v26.9.1')) {
      return new Response(JSON.stringify(vendorEntries), { status: 200 })
    }
    throw new Error(`unexpected fixture URL: ${url}`)
  }
}

test('uses a pinned SHA when GitHub labels a declared submodule as a file', async () => {
  useGitHubFixtures([
    { name: 'nim-blscurve', path: 'vendor/nim-blscurve', type: 'file', sha: '9ffb9a-pinned' },
    { name: 'README', path: 'vendor/README', type: 'file', sha: 'ordinary-file' },
  ])

  const result = await collectNimbus(config)
  assert.equal(result.deps.find(dep => dep.name === 'nim-blscurve')?.version, '9ffb9a-pinned')
})

test('continues to accept explicit submodule entries', async () => {
  useGitHubFixtures([
    { name: 'nim-blscurve', path: 'vendor/nim-blscurve', type: 'submodule', sha: 'future-pinned' },
  ])

  const result = await collectNimbus(config)
  assert.equal(result.deps.find(dep => dep.name === 'nim-blscurve')?.version, 'future-pinned')
})

test('falls back to the declared branch when the vendor entry is missing', async () => {
  useGitHubFixtures([])

  const result = await collectNimbus(config)
  assert.equal(result.deps.find(dep => dep.name === 'nim-blscurve')?.version, 'master')
})
