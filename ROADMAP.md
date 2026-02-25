# Roadmap

Features already planned, ordered roughly by priority.

---

## 1. Version grouping & divergence table

**What:** Group shared deps by package name, ignoring version. Show cases where clients share a package but are on different versions.

**Why:** A CVE affects `tokio@1.28.x` but not `1.36.x` — which clients are exposed? Currently `tokio@1.28.1` and `tokio@1.36.0` appear as two unrelated rows.

**Implementation:**
- Strip `@version` from PURL when building the frequency map (or build a secondary grouped map)
- Add a "Version divergence" column/page showing packages where 2+ clients use different versions
- Highlight rows where versions differ significantly (major/minor bump)

---

## 2. Risk scoring

**What:** Weight shared deps by combined EL+CL network coverage rather than raw client count.

**Why:** A dep shared by Geth (41% nodes) + Prysm (28% validators) is a far bigger risk than one shared by Erigon (6%) + Nimbus (12%), even though both are "shared by 2 clients".

**Formula:** `riskScore = elCoverage × clCoverage` — a dep that bridges both layers with high coverage gets a high score. Pure-EL or pure-CL deps score zero on this cross-layer metric but still matter within-layer.

**Implementation:**
- Add `riskScore` field to `FrequencyEntry` in the collector
- Sort the overview table by risk score by default, with a toggle to sort by client count
- Colour-code rows: red (high), amber (medium), grey (low)

---

## 3. CVE overlay

**What:** Query [OSV.dev](https://osv.dev/docs/) for known vulnerabilities against every PURL in the dataset. Flag vulnerable packages in all tables.

**Why:** Direct utility — "here are the shared deps that have active CVEs, weighted by how much of the network would be affected".

**Implementation:**
- Post-collection step in CI: batch-query `https://api.osv.dev/v1/querybatch` with all PURLs
- Store CVE hits in `data/vulns.json` (or inline into `deps.json`)
- Add a `⚠ CVE` badge in the Libraries and Overview tables, linking to osv.dev
- Add a dedicated Vulnerabilities page sorted by risk score × CVE severity

---

## 4. Historical trending

**What:** Since the CI cron commits `deps.json` daily, chart how shared dependency count, cross-layer count, and top-dep coverage change over time.

**Why:** Shows whether the ecosystem is converging (more sharing) or diverging as clients update, and when specific deps were added or dropped.

**Implementation:**
- CI appends a snapshot row to `data/history.jsonl` on each successful collection
- Dashboard fetches `history.jsonl` and renders a time-series chart (Recharts `LineChart`)
- Key metrics to track: total shared count, cross-layer count, top-10 dep EL+CL coverage

---

## 5. Native dep detection via build capture

**What:** Capture transitive CGO dependencies by running the actual Go/Rust build and parsing linker output, rather than static source scanning.

**Why:** The current static scan misses any C library pulled in transitively (e.g. a Go dep that uses `#cgo` internally). The two known gaps are:
- Indirect CGO deps — require actually running `go build -v` and parsing `-extldflags`
- `dlopen` / `LoadLibrary` calls with runtime-computed paths

**Implementation:**
- Add a `native-build` CI job that checks out each client, runs `go build -v ./... 2>&1 | grep cgo` or `cargo build --verbose 2>&1 | grep 'native-static-libs'`, and extracts linked library names
- Merge results with the existing static-scan native deps
- This requires Docker or a language toolchain in CI — treat as a separate optional collector stage

---

## 6. Docker SBOM attestations

**What:** Parse SBOM attestations from client Docker images (`docker buildx imagetools inspect --format '{{json .SBOM}}'`) to get a more authoritative dep list, especially for native libs baked into images.

**Why:** Some clients publish signed SBOM attestations that include system packages (apt/apk), which our source-level scanning cannot see.

**Implementation:**
- Add a `sbom` collector stage in CI using `docker` CLI
- Parse SPDX or CycloneDX format
- Merge with existing package dep list, deduplicating by PURL

---

## Known permanent limitations

| Limitation | Reason | Workaround |
|------------|--------|------------|
| Teku: direct deps only | No lock file in repo | Request lock file from team |
| Nimbus: `pkg:github//` PURLs don't cross-match | Nim has no package registry PURL type | Manual canonical mappings |
| `dlopen` / runtime-loaded libs | Determined at runtime, not statically | SBOM attestations (feature #6) |
| Prysm: Go module graph only (no Bazel) | Bazel build graph not parseable without running Bazel | Build capture (feature #5) |
| Indirect CGO / transitive native deps | Requires running the actual build | Build capture (feature #5) |
