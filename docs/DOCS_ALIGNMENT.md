# Midnight documentation alignment

Source: user-supplied `midnight-docs-main` repository snapshot.

Targeted Compact language/toolchain from current token tutorials:

- Compact language: `0.23`
- compactc target in tutorials: `0.31.1`
- Node.js: 22+

Key documented primitives used:

- `tokenType(domainSep, contract)`
- `mintShieldedToken(domainSep, value, nonce, recipient)`
- `evolveNonce(index, nonce)`
- `receiveShielded(coin)`
- `sendShielded(input, recipient, value)`
- `sendImmediateShielded(input, target, value)`
- `shieldedBurnAddress()`
- `receiveUnshielded(color, amount)`
- `sendUnshielded(color, amount, recipient)`
- `unshieldedBalanceGte(color, amount)`
- `persistentCommit(value, rand)`
- `persistentHash(value)`
- `MerkleTree` / `MerkleTreePath` / `merkleTreePathRoot`
- `blockTimeLt`, `blockTimeLte`, `blockTimeGt`

Privacy rule applied from the docs:

> Ordinary ledger operation arguments and ledger reads/writes are public, except for the special privacy properties of Merkle-tree insertion/membership patterns. Therefore Balary commits salary data rather than writing salary coin metadata directly to ledger state.

Authentication rule applied from the shielded-token and ZK Loan tutorials:

> `ownPublicKey()` must not be used as an authentication primitive. Balary derives employer and employee identities from private secrets with domain-separated persistent hashes.
