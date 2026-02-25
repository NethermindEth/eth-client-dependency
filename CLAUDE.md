# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
pnpm install

# Run the collector (requires GITHUB_TOKEN in .env)
pnpm collect                          # from repo root
pnpm --filter collector run collect   # equivalent

# Dashboard development
pnpm dev                              # from repo root
pnpm --filter dashboard run dev       # equivalent — http://localhost:3000

# Dashboard production build
pnpm build

# Typecheck collector
pnpm --filter collector run typecheck
```

The collector requires a `.env` file in `packages/collector/` (or repo root) with:
```
GITHUB_TOKEN=ghp_...
```

The CI secret is named `COLLECTOR_GITHUB_TOKEN`.

## Architecture

This is a pnpm monorepo with two packages and a shared data file.

```
packages/collector/   TypeScript CLI that fetches dep data from client repos
packages/dashboard/   Next.js 15 app that visualises the data
data/deps.json        Output of collector, input of dashboard
mappings/canonical.yaml  Cross-ecosystem library identity mappings
```

### Data flow

```
GitHub APIs / raw.githubusercontent.com
        ↓
packages/collector/src/clients/*.ts   (one file per client)
        ↓
packages/collector/src/index.ts       (orchestrates, computes frequency + aggregates, writes output)
        ↓
data/deps.json                        (committed to repo by CI cron daily)
        ↓
packages/dashboard/lib/data.ts        (getDepsData: reads local file in dev, fetches URL in prod)
        ↓
Next.js server components
```

### Collector internals (`packages/collector/src/`)

- **`types.ts`** — all shared interfaces: `ClientConfig`, `RawDep`, `ClientResult`, `FrequencyEntry`, `DepsOutput`, plus pre-computed aggregate types `SharedDep`, `EcosystemStat`, `NativeDepEntry`
- **`config.ts`** — the 10 clients with their `elNetworkShare` / `clNetworkShare` fractions
- **`clients/*.ts`** — one file per client, each exports `collectX(config): Promise<ClientResult>`. Every client uses a different lock file format:
  - `geth`, `erigon`, `prysm` → `go.sum` (skip lines where version ends with `/go.mod`)
  - `reth`, `lighthouse` → `Cargo.lock` (TOML, filter workspace members where `source=null`)
  - `lodestar` → `pnpm-lock.yaml` v9 (`packages` + `snapshots` sections)
  - `besu` → `gradle/verification-metadata.xml` (~928 components, full transitive)
  - `teku` → `gradle/versions.gradle` (direct deps only, regex parsed)
  - `nethermind` → `src/Nethermind/Nethermind.Runner/packages.lock.json` (~194 NuGet transitive deps)
  - `nimbus` → `.gitmodules` + GitHub Contents API for pinned commit SHAs → `pkg:github//` PURLs
- **`lib/fetch.ts`** — `fetchRaw(repo, ref, path)` uses `raw.githubusercontent.com` (bypasses SAML SSO). `getLatestTag` tries GitHub Releases API then falls back to HTML redirect for SAML-blocked orgs (NethermindEth). `fetchDirContents` calls the GitHub Contents API (used by Nimbus for submodule SHAs).
- **`lib/gosum.ts`** — `parseGoSum(content, selfModule)` and `parseGoModReplacements(content)`, shared by `geth`, `erigon`, `prysm`
- **`lib/cargo.ts`** — `collectCargoDevDeps(repo, tag)` shared by `reth` and `lighthouse` for workspace dev-dep detection
- **`lib/cratesio.ts`** — resolves Rust `-sys` crates to native lib names via the crates.io sparse index `links` field
- **`lib/search.ts`** — `scanCGO` (Go), `scanJNI` (Java), `scanDllImport` (C#) for native dep detection via GitHub Code Search. Exports `SYSTEM_LIBS` — the authoritative set of OS/system library names filtered at both scan time and aggregation time.
- **`normalize/purl.ts`** — normalises PURLs to canonical form
- **`normalize/canonical.ts`** — loads `mappings/canonical.yaml`, provides `lookupCanonical(purlOrNativeName)`
- **`index.ts`** — orchestrates collection, then computes and embeds three pre-aggregated fields:
  - `computeTopSharedDeps` — groups `frequency` by `canonicalId`, deduplicates client lists, recomputes coverage. Uses `PURL_ECO_MAP` (`npm → 'typescript'` to align with Lodestar's `client.ecosystem`).
  - `computeEcosystemStats` — per-ecosystem sharing rates, keyed by `client.ecosystem`
  - `computeNativeDeps` — aggregates native deps from `RawDep[]`, filters `SYSTEM_LIBS`

### Dashboard internals (`packages/dashboard/`)

- **`lib/data.ts`** — types + `getDepsData()`. In dev reads `../../data/deps.json` via `fs`; in prod fetches `NEXT_PUBLIC_DATA_URL` (set to the raw GitHub URL of `data/deps.json`) with `cache: 'no-store'`. Declares `SharedDep`, `EcosystemStat`, `NativeDepEntry` (mirrors of collector types) and `DepsData` with optional `topSharedDeps`, `ecosystemStats`, `nativeDeps`, `failedClients` fields.
- **`app/page.tsx`** — overview. Shows `failedClients` warning banner and stale-format notice when pre-computed fields are absent.
- **`app/libraries/page.tsx`** — uses `data.topSharedDeps`, caps full table at 500 rows.
- **`app/native/page.tsx`** — uses `data.nativeDeps` directly (no runtime aggregation).
- **`app/ecosystems/page.tsx`** — server component, uses `data.ecosystemStats`. `EcosystemChart` is the only `'use client'` component (Recharts).
- **`app/clients/page.tsx`** — per-client breakdown. Builds `canonicalClientMap` and `sharedDepByCanonical` from frequency/topSharedDeps for consistent coverage numbers. Only considers `packageDeps` for the shared-dep list (native deps shown separately).
- All pages export `dynamic = 'force-dynamic'` to prevent Next.js SSG from trying to fetch data at build time.

### Cross-ecosystem canonical mapping

`mappings/canonical.yaml` maps equivalent libraries across ecosystems (e.g. `rocksdb` in Rust `pkg:cargo/rocksdb`, Java `pkg:maven/org.rocksdb/rocksdbjni`, and native `rocksdb`). The `canonicalId` field on `FrequencyEntry` and `NormalizedDep` is set at collection time by `lookupCanonical`. The same grouping is applied in `computeTopSharedDeps` to merge cross-ecosystem entries into a single `SharedDep` row.

### Key data shape

`data/deps.json` has this top-level shape:
```typescript
{
  generatedAt: string
  clients: ClientMeta[]                      // successful clients only
  deps: Record<clientId, NormalizedDep[]>    // per-client dep list (prod only)
  frequency: Record<purl, FrequencyEntry>    // all unique PURLs across all clients
  failedClients: Array<{ id: string; error: string }>
  networkSharesSource: { elSource, clSource, ... }
  // Pre-computed aggregates (absent in data files predating this schema):
  topSharedDeps: SharedDep[]                 // sorted by client count desc, all entries with 2+ clients
  ecosystemStats: Record<ecosystem, EcosystemStat>
  nativeDeps: NativeDepEntry[]               // sorted by client count desc, system libs excluded
}
```

`FrequencyEntry.elCoverage` and `clCoverage` are additive fractions (e.g. 0.41 + 0.06 = 0.47 for a dep in both Geth and Erigon).

### Adding a new client

1. Add `ClientConfig` entry to `packages/collector/src/config.ts`
2. Create `packages/collector/src/clients/<name>.ts` exporting `collectX(config): Promise<ClientResult>`
3. Register it in the `collectors` map in `packages/collector/src/index.ts`
4. If the client uses a new package manager, add the PURL type → ecosystem label mapping in `PURL_ECO_MAP` in `packages/collector/src/index.ts`
