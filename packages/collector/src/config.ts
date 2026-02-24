import type { ClientConfig } from './types.js'

export const CLIENTS: ClientConfig[] = [
  // Execution Layer
  {
    id: 'geth',
    name: 'Geth',
    repo: 'ethereum/go-ethereum',
    layer: 'EL',
    ecosystem: 'go',
    elNetworkShare: 0.41,
    clNetworkShare: 0,
  },
  {
    id: 'nethermind',
    name: 'Nethermind',
    repo: 'NethermindEth/nethermind',
    layer: 'EL',
    ecosystem: 'dotnet',
    elNetworkShare: 0.38,
    clNetworkShare: 0,
  },
  {
    id: 'besu',
    name: 'Besu',
    repo: 'hyperledger/besu',
    layer: 'EL',
    ecosystem: 'java',
    elNetworkShare: 0.09,
    clNetworkShare: 0,
  },
  {
    id: 'erigon',
    name: 'Erigon',
    repo: 'erigontech/erigon',
    layer: 'EL',
    ecosystem: 'go',
    elNetworkShare: 0.06,
    clNetworkShare: 0,
  },
  {
    id: 'reth',
    name: 'Reth',
    repo: 'paradigmxyz/reth',
    layer: 'EL',
    ecosystem: 'rust',
    elNetworkShare: 0.05,
    clNetworkShare: 0,
  },
  // Consensus Layer
  {
    id: 'lighthouse',
    name: 'Lighthouse',
    repo: 'sigp/lighthouse',
    layer: 'CL',
    ecosystem: 'rust',
    elNetworkShare: 0,
    clNetworkShare: 0.38,
  },
  {
    id: 'prysm',
    name: 'Prysm',
    repo: 'prysmaticlabs/prysm',
    layer: 'CL',
    ecosystem: 'go',
    elNetworkShare: 0,
    clNetworkShare: 0.28,
  },
  {
    id: 'teku',
    name: 'Teku',
    repo: 'Consensys/teku',
    layer: 'CL',
    ecosystem: 'java',
    elNetworkShare: 0,
    clNetworkShare: 0.13,
  },
  {
    id: 'lodestar',
    name: 'Lodestar',
    repo: 'ChainSafe/lodestar',
    layer: 'CL',
    ecosystem: 'typescript',
    elNetworkShare: 0,
    clNetworkShare: 0.07,
  },
  {
    id: 'nimbus',
    name: 'Nimbus',
    repo: 'status-im/nimbus-eth2',
    layer: 'CL',
    ecosystem: 'nim',
    elNetworkShare: 0,
    clNetworkShare: 0.12,
  },
]

export const EL_CLIENTS = CLIENTS.filter(c => c.layer === 'EL')
export const CL_CLIENTS = CLIENTS.filter(c => c.layer === 'CL')
