# eth-dependency

Tracks and visualises shared dependency concentration across Ethereum execution and consensus layer clients. Surfaces cross-client and cross-layer library overlap — including native C/C++ dependencies detected via FFI — weighted by real network share.

## Why this exists

A critical vulnerability in a shared dependency can simultaneously affect multiple Ethereum clients. The more of the network those clients cover, the higher the systemic risk. This project makes that overlap visible: which libraries does Geth share with Lighthouse? Which C libraries are linked by both EL and CL clients? How much of the validator set is exposed if `blst` has a bug?

## Clients tracked

| Client | Layer | Ecosystem | Network share |
|--------|-------|-----------|---------------|
| [Geth](https://github.com/ethereum/go-ethereum) | EL | Go | 41% of nodes |
| [Nethermind](https://github.com/NethermindEth/nethermind) | EL | .NET | 38% of nodes |
| [Besu](https://github.com/hyperledger/besu) | EL | Java | 9% of nodes |
| [Erigon](https://github.com/erigontech/erigon) | EL | Go | 6% of nodes |
| [Reth](https://github.com/paradigmxyz/reth) | EL | Rust | 5% of nodes |
| [Prysm](https://github.com/prysmaticlabs/prysm) | CL | Go | 28% of validators |
| [Lighthouse](https://github.com/sigp/lighthouse) | CL | Rust | 38% of validators |
| [Teku](https://github.com/Consensys/teku) | CL | Java | 13% of validators |
| [Nimbus](https://github.com/status-im/nimbus-eth2) | CL | Nim | 12% of validators |
| [Lodestar](https://github.com/ChainSafe/lodestar) | CL | TypeScript | 7% of validators |

## Dashboard pages

- **Overview** — top shared dependencies sorted by client count, with EL/CL coverage bars
- **Libraries** — dependency matrix heatmap + full shared dep table with cross-ecosystem canonical grouping
- **Clients** — per-client breakdown showing shared deps and limitations
- **Ecosystems** — within-ecosystem sharing rate by language (Go, Rust, Java, etc.)
- **Native Deps** — C/C++ libraries detected via CGO directives, JNI calls, `-sys` crates, and P/Invoke attributes

## Architecture

```
packages/collector/   TypeScript CLI — fetches lock files from GitHub, detects native deps
packages/dashboard/   Next.js 15 app — visualises data/deps.json
data/deps.json        Output of collector, input of dashboard (committed daily by CI)
mappings/canonical.yaml  Cross-ecosystem library identity mappings
```

The collector fetches dependency data directly from each client's source repository using the GitHub API, then normalises everything to [PURLs](https://github.com/package-url/purl-spec). A GitHub Actions cron job runs it daily and commits the updated `deps.json`.

### Lock file sources

| Client | Source | Dep type |
|--------|--------|----------|
| Geth, Erigon, Prysm | `go.sum` | Full transitive |
| Reth, Lighthouse | `Cargo.lock` | Full transitive |
| Lodestar | `pnpm-lock.yaml` | Full transitive |
| Besu | `gradle/verification-metadata.xml` | Full transitive (928 components) |
| Teku | `gradle/versions.gradle` | Direct only |
| Nethermind | `Directory.Packages.props` | Direct only |
| Nimbus | `.gitmodules` | Git submodules (`pkg:github//` PURLs) |

### Native dependency detection

Native (C/C++) libraries are detected statically from source:

- **Go** — `#cgo` directives scanned via GitHub Code Search
- **Rust** — `-sys` crates resolved to native lib names via the crates.io sparse index `links` field
- **Java** — `System.loadLibrary()` calls scanned in source
- **C#** — `[DllImport]` / `[LibraryImport]` attributes scanned in source

### Cross-ecosystem canonical mapping

`mappings/canonical.yaml` maps equivalent libraries across ecosystems. For example, `rocksdb` appears as `pkg:cargo/rocksdb` in Reth/Lighthouse and `pkg:maven/org.rocksdb/rocksdbjni` in Besu — the canonical ID `rocksdb` links them. Current mappings: `libsecp256k1`, `blst`, `kzg`, `rocksdb`, `leveldb`, `openssl`, `libp2p`, `snappy`, `bouncycastle`, `protobuf`.

## Running locally

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9+
- A GitHub personal access token with `repo` scope (for Code Search API)

### Setup

```bash
git clone https://github.com/NethermindEth/eth-client-dependency
cd eth-client-dependency
pnpm install
```

Create `packages/collector/.env`:

```
GITHUB_TOKEN=ghp_your_token_here
```

### Run the collector

```bash
pnpm collect
```

Writes fresh data to `data/deps.json`. Takes ~2 minutes (sequential to respect GitHub's 30 req/min Code Search limit).

### Run the dashboard

```bash
pnpm dev       # http://localhost:3000
pnpm build     # production build
```

In development, the dashboard reads `data/deps.json` from the local filesystem. In production it fetches from `NEXT_PUBLIC_DATA_URL` (set to the raw GitHub URL of `data/deps.json`).

## CI

A GitHub Actions workflow (`.github/workflows/collect.yml`) runs the collector daily at 04:00 UTC and commits updated `data/deps.json` back to `main`. It uses the `COLLECTOR_GITHUB_TOKEN` repository secret.

To trigger manually:

```bash
gh workflow run collect.yml --repo NethermindEth/eth-client-dependency
```

## Adding a new client

1. Add a `ClientConfig` entry to `packages/collector/src/config.ts`
2. Create `packages/collector/src/clients/<name>.ts` exporting `collectX(config): Promise<ClientResult>`
3. Register it in the `collectors` map in `packages/collector/src/index.ts`
4. If the client uses a new package manager, add the PURL type → ecosystem mapping in `packages/dashboard/lib/stats.ts` (`PURL_ECO_MAP`)

## Known limitations

| Limitation | Reason |
|------------|--------|
| Teku & Nethermind: direct deps only | No lock file in repo |
| Nimbus: `pkg:github//` PURLs don't cross-match | Nim has no package registry PURL type |
| Indirect CGO / transitive native deps | Requires running the actual build |
| `dlopen` / runtime-loaded libs | Determined at runtime, not statically |
| Prysm: Go module graph only, no Bazel | Bazel build graph requires running Bazel |
