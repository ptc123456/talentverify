# TalentVerify

TalentVerify is an evidence-backed skill attestation dApp on GenLayer Studionet. A wallet submits a claimed skill, a GitHub username, and one to three public repositories. The Intelligent Contract collects a bounded set of public GitHub signals, asks a leader and validators to evaluate the same evidence independently, and stores the consensus verdict, reason, and evidence summary on-chain.

TalentVerify evaluates whether the submitted public repository signals support a skill claim. It does **not** verify a person's identity, control of a GitHub account, repository ownership, code authorship, employment history, or overall hiring suitability.

## Verified deployment

| Item | Value |
| --- | --- |
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Contract | [`0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14`](https://explorer-studio.genlayer.com/address/0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14) |
| Deployment transaction | [`0xf87ff6c3ce9562d99d36ca6f36dd2b2c92792c5e9274d10017f295d55a8bab4c`](https://explorer-studio.genlayer.com/tx/0xf87ff6c3ce9562d99d36ca6f36dd2b2c92792c5e9274d10017f295d55a8bab4c) |
| Live application | [talentverify-genlayer.vercel.app](https://talentverify-genlayer.vercel.app/) |
| Source repository | [github.com/ptc123456/talentverify](https://github.com/ptc123456/talentverify) |

Studionet is a hosted development network and is not a production network. Its availability and persistence are controlled by the GenLayer development environment.

## The trust problem

A self-declared skill on a profile is easy to make, while a private review by one recruiter, platform, or LLM service requires every participant to trust that operator's evidence selection, prompt, model, and stored result. TalentVerify provides a narrower, inspectable alternative: the input repositories are public, the evaluation policy runs inside an Intelligent Contract, multiple GenLayer validators independently repeat the evidence collection and assessment, and the accepted result becomes publicly queryable contract state.

The practical consequence of a finalized verdict is a wallet-linked entry in the TalentVerify registry. Reviewers can inspect the submitted repositories, verdict, reason, and evidence summary instead of relying only on a self-asserted claim. The result is evidence support, not a professional certification or proof of who wrote the code.

## Why GenLayer is essential

Traditional deterministic contracts cannot fetch current GitHub data or make a qualitative judgment about whether mixed repository signals support a skill. A centralized backend can do both, but its operator can change the model, prompt, evidence, or result without network consensus.

TalentVerify keeps the consensus-critical decision in the Intelligent Contract:

1. The leader uses `gl.nondet.web.request` to collect public GitHub evidence.
2. The leader uses `gl.nondet.exec_prompt` to produce a structured verdict.
3. The validator calls the same evaluation function, independently fetching and assessing the evidence.
4. The validator accepts the proposal only when its independently reached verdict matches the leader's verdict; schema and policy validation are additional guards.
5. `gl.vm.run_nondet_unsafe` returns only the consensus-approved payload, after which deterministic code writes the verdict, reason, evidence summary, and timestamps to storage.

This is the product's core trust mechanism, not an off-chain AI call whose output is merely copied to a blockchain.

## Evidence collected by the contract

For each submitted repository, the contract derives the owner and repository name from a strictly validated `https://github.com/<owner>/<repository>` URL. The URL owner segment must match the entered GitHub username, case-insensitively. This string match is not proof that the connected wallet controls that GitHub account.

The contract then requests:

- Repository metadata from `https://api.github.com/repos/<owner>/<repository>`: name, description, fork status, archive status, and default branch.
- Language totals from `https://api.github.com/repos/<owner>/<repository>/languages`.
- `package.json` from `raw.githubusercontent.com` for React claims, extracting React-related dependencies.
- `Cargo.toml` from `raw.githubusercontent.com` for Rust claims, extracting a bounded dependency summary.

The current contract does not download or execute the repository's full source tree. GitHub content is treated as untrusted evidence, and the LLM prompt explicitly instructs validators to ignore instructions embedded in repository data.

## Verdicts

- `SUPPORTED`: the available public signals support the requested skill.
- `INSUFFICIENT_EVIDENCE`: the evidence is too weak or incomplete to support the claim.
- `NOT_SUPPORTED`: the available evidence does not support or contradicts the claim.
- `INCONCLUSIVE`: the evidence cannot be evaluated reliably, including when all external sources fail.

These verdicts are scoped to the submitted evidence and the selected skill.

## Architecture

```text
React + TypeScript frontend
  |-- MetaMask / EIP-1193 wallet
  |-- genlayer-js 1.1.8
  |-- readContract / writeContract / getTransaction
  v
GenLayer Studionet RPC (Chain ID 61999)
  v
TalentVerify Python Intelligent Contract
  |-- deterministic validation and storage
  |-- GitHub public API + raw.githubusercontent.com
  |-- gl.nondet.exec_prompt
  `-- leader/validator semantic verdict comparison
```

The contract exposes two write methods:

- `request_verification(skill, github_username, repo_url_1, repo_url_2, repo_url_3)`
- `evaluate_request(request_id)`

It exposes three view methods:

- `get_request(request_id)`
- `get_request_count()`
- `get_attestations(owner)`

The frontend uses `genlayer-js` for real Studionet reads and writes. It does not use a project backend or a centralized LLM API.

## User flow and transaction lifecycle

1. Open the live app and connect MetaMask or another injected EIP-1193 wallet.
2. The wallet flow checks Chain ID `61999`, requests a network switch, or adds GenLayer Studionet with the official RPC.
3. Select one of the five supported skills: React, TypeScript, Python, Solidity, or Rust.
4. Enter a GitHub username and one to three matching public repository URLs.
5. The frontend reads `get_request_count`, then calls `request_verification` with `writeContract` and asks the wallet to sign.
6. The frontend polls the transaction with `getTransaction`, displaying pending, proposal, commit/reveal consensus, accepted, finalization, timeout, cancellation, RPC failure, and execution failure states.
7. `ACCEPTED` is not treated as success. The frontend waits for `FINALIZED`, requires `MAJORITY_AGREE`, and requires successful execution receipts before reading the updated state.
8. The submitted transaction context is stored in `sessionStorage`, allowing monitoring and request-ID recovery to resume after a refresh in the same browser session.
9. On the request page, the submitting wallet can trigger `evaluate_request`. The contract method itself is permissionless, so another caller can also pay to trigger evaluation directly.
10. The second transaction follows the same consensus and finalization checks. After successful execution, the frontend reads and displays the finalized verdict, reason, and evidence summary.
11. Any wallet address can be queried through the registry view to list up to its 50 most recent finalized TalentVerify attestations.

## Trust boundaries and failure states

- **No identity or ownership proof:** matching a URL owner segment to a username does not prove wallet-to-GitHub control or code authorship.
- **Public evidence only:** private repositories and private contribution history are outside V1.
- **Bounded evidence:** the contract uses metadata, language totals, and selected manifests rather than a complete source-code audit.
- **External availability:** GitHub outages, unauthenticated API rate limits, removed repositories, malformed responses, or unsafe branch names can reduce evidence or produce `INCONCLUSIVE`.
- **Model variability:** LLM output is non-deterministic. The validator independently repeats the task and compares the stable verdict; free-form wording may differ.
- **Consensus failure:** disagreement or network timeouts can leave a transaction canceled or undetermined without writing the attestation.
- **Execution failure:** a transaction may be finalized while contract execution failed. The frontend checks the execution result instead of treating finalization alone as success.
- **RPC and wallet failure:** missing wallets, rejected signatures, wrong networks, unavailable RPC responses, and polling timeouts are surfaced as recoverable UI errors.
- **Studionet scope:** the deployed instance is for development and demonstration, not production credentials.

## Local setup

### Prerequisites

- Node.js 22 or a compatible current Node.js release
- npm
- Python 3.12

### Frontend

```powershell
cd E:\Genlayer-Projects\talentverify\frontend
npm ci
Copy-Item .env.example .env.local
```

Set the verified deployed contract in `frontend/.env.local`:

```dotenv
VITE_GENLAYER_CONTRACT_ADDRESS=0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14
```

Run the development server:

```powershell
npm run dev
```

### Contract test environment

```powershell
cd E:\Genlayer-Projects\talentverify
py -3.12 -m venv .venv-review
.\.venv-review\Scripts\python.exe -m pip install -r requirements-dev.txt
```

## Verification commands

The latest local verification completed successfully with **49 Python contract tests** and **78 frontend tests**.

```powershell
# Contract compilation and Direct Mode tests
.\.venv-review\Scripts\python.exe -m compileall -q contracts tests
.\.venv-review\Scripts\pytest.exe tests\ -q

# GenVM static checks
.\.venv-review\Scripts\genvm-lint.exe lint contracts\talent_verify.py --json
.\.venv-review\Scripts\genvm-lint.exe validate contracts\talent_verify.py --json
.\.venv-review\Scripts\genvm-lint.exe check contracts\talent_verify.py --json
$env:PYTHONIOENCODING = "utf-8"
$env:PATH = "E:\Genlayer-Projects\talentverify\.venv-review\Scripts;" + $env:PATH
.\.venv-review\Scripts\genvm-lint.exe typecheck contracts\talent_verify.py --all

# Frontend tests and production checks
cd frontend
npm test -- --run
npm run lint
npm run typecheck
npm run build
npm run smoke:read
```

The Python suite uses Direct Mode with mocked web and LLM responses. It verifies contract logic and edge cases but does not simulate a live multi-validator network. The read-only smoke script calls `get_request_count()` on the deployed Studionet contract configured in `.env.local`.

`genvm-lint validate` currently passes with one informational `I200` notice that a newer runner is available. The dependency hash in the repository is retained because it matches both the current official documentation example and the already deployed Studionet contract; changing it would require a new deployment and address.

## Production build and deployment

Build the frontend with:

```powershell
cd frontend
npm ci
npm run build
```

For a new frontend deployment, set `VITE_GENLAYER_CONTRACT_ADDRESS` to a real deployed contract address in the hosting environment, use `frontend` as the project root, and publish the generated Vite application. Never use a placeholder address.

For a new contract deployment, open [GenLayer Studio](https://studio.genlayer.com/), load `contracts/talent_verify.py`, deploy to Studionet, and verify both transaction status `FINALIZED` and successful execution before connecting a frontend to the resulting address. A changed contract source or dependency requires a new deployment and a coordinated frontend configuration update.
