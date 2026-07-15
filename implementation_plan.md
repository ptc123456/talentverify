# Implementation Plan — TalentVerify Phase 2: Frontend & Studionet Integration

This updated implementation plan covers the complete frontend implementation and real Studionet integration for **TalentVerify**, incorporating all 11 mandatory Codex corrections.

---

## User Review Required

> [!IMPORTANT]
> **Verified Contract Lock**: We will use the authorized contract address `0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14` and target only GenLayer Studionet. No fake or placeholder addresses will be used.
> **No Automated Key Signatures**: No local private keys or generated accounts will be used for writes in production or in tests. The browser wallet (e.g., MetaMask) will sign all live writes.
> **No Git Initialization**: The local workspace directory `E:\Genlayer-Projects\talentverify` is not yet a Git repository, and we will not run `git init`, commit, or push GitHub.
> **Frontend Directory Lock**: All npm commands, package installation, typecheck, lint, tests, build, and smoke-read commands must run exclusively from: `E:\Genlayer-Projects\talentverify\frontend`.

---

## Proposed Changes

We will create a Vite + React + TypeScript single-page application under a new `frontend/` subdirectory inside `E:\Genlayer-Projects\talentverify`.

### 1. Build and Environment Configurations

#### [NEW] [package.json](file:///E:/Genlayer-Projects/talentverify/frontend/package.json)
Contains all exact dependencies with exact versions (`--save-exact` lock):
*   **Production**: `react@19.2.7`, `react-dom@19.2.7`, `react-router-dom@7.18.1`, `genlayer-js@1.1.8`, `lucide-react@1.24.0`
*   **Development**: `vite@8.1.4`, `typescript@7.0.2`, `@vitejs/plugin-react@6.0.3`, `vitest@4.1.10`, `@testing-library/react@16.3.2`, `@testing-library/jest-dom@6.9.1`, `jsdom@29.1.1`, `eslint@10.7.0`, `@eslint/js@10.0.1`, `typescript-eslint@8.64.0`, `eslint-plugin-react-hooks@7.1.1`, `eslint-plugin-react-refresh@0.5.3`, `globals@17.7.0`, `@types/react@19.2.17`, `@types/react-dom@19.2.3`, `@types/node@26.1.1`

#### [NEW] [package-lock.json](file:///E:/Genlayer-Projects/talentverify/frontend/package-lock.json)
Will be generated automatically by npm upon installation, locking exact dependency sub-trees.

#### [NEW] [tsconfig.json](file:///E:/Genlayer-Projects/talentverify/frontend/tsconfig.json)
Configures baseline TypeScript options, referencing `tsconfig.app.json` and `tsconfig.node.json`.

#### [NEW] [tsconfig.app.json](file:///E:/Genlayer-Projects/talentverify/frontend/tsconfig.app.json)
Defines TypeScript configuration for app code, including React 19 JSX options, DOM types, and path aliases.

#### [NEW] [tsconfig.node.json](file:///E:/Genlayer-Projects/talentverify/frontend/tsconfig.node.json)
Configures TypeScript options for Vite config and other Node toolchain files.

#### [NEW] [vite.config.ts](file:///E:/Genlayer-Projects/talentverify/frontend/vite.config.ts)
Vite configuration loading `@vitejs/plugin-react` and setting up Vitest.

#### [NEW] [eslint.config.js](file:///E:/Genlayer-Projects/talentverify/frontend/eslint.config.js)
ESLint flat config file setting up react, react-hooks, react-refresh, and typescript-eslint guidelines.

#### [NEW] [vercel.json](file:///E:/Genlayer-Projects/talentverify/frontend/vercel.json)
Configures single-page application routing redirection for Vercel deployment.

#### [NEW] [.env.local](file:///E:/Genlayer-Projects/talentverify/frontend/.env.local)
Real contract address configuration (ignored by Git):
`VITE_GENLAYER_CONTRACT_ADDRESS=0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14`

#### [NEW] [.env.example](file:///E:/Genlayer-Projects/talentverify/frontend/.env.example)
Example file with an empty address key.

#### [NEW] [index.html](file:///E:/Genlayer-Projects/talentverify/frontend/index.html)
SPA entry HTML shell referencing `/src/main.tsx`.

#### [NEW] [main.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/main.tsx)
Mounts the React application into the `#root` element under `<StrictMode>`.

#### [NEW] [vite-env.d.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/vite-env.d.ts)
Vite environment types declaration for `import.meta.env`.

#### [MODIFY] [README.md](file:///E:/Genlayer-Projects/talentverify/README.md)
Update with Phase 2 documentation:
*   Add deployment section specifying the contract address `0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14` and the transaction `0xf87ff6c3ce9562d99d36ca6f36dd2b2c92792c5e9274d10017f295d55a8bab4c`.
*   Replace "not deployed" state.
*   Document frontend installation, run, test, and preview instructions under the `frontend/` directory.
*   Detail the two-phase on-chain transaction lifecycle: submission (`request_verification`) and evaluation (`evaluate_request`).
*   Include the manual browser smoke-test steps and disclaimers.

#### [MODIFY] [PROJECT_SPEC.md](file:///E:/Genlayer-Projects/talentverify/PROJECT_SPEC.md)
Document contract status as officially deployed on Studionet, detailing the contract address and transaction, removing the obsolete frontend address blocker.

#### [MODIFY] [.gitignore](file:///E:/Genlayer-Projects/talentverify/.gitignore)
Appends `frontend/node_modules/`, `frontend/dist/`, `frontend/.env.local`, and custom build caches.

---

### 2. Domain Types & Client-Side Validation

#### [NEW] [domain.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/types/domain.ts)
Defines domain types: `VerificationRequest`, `Attestation`, `Verdict` (`SUPPORTED` | `INSUFFICIENT_EVIDENCE` | `NOT_SUPPORTED` | `INCONCLUSIVE`), `RequestStatus` (`SUBMITTED` | `FINALIZED`), and transaction status types.

#### [NEW] [ethereum.d.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/types/ethereum.d.ts)
Adds EIP-1193 typings for `window.ethereum` to ensure compile-time safety without using `any`.

#### [NEW] [validation.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/lib/validation.ts)
Client-side validators for form fields mirroring contract logic:
*   GitHub Username: trim, 1-39 characters, alphanumeric or internal hyphens, cannot start/end with hyphen.
*   Repository URLs:
    *   Maximum 200 characters each.
    *   HTTPS only.
    *   Hostname exactly `github.com`.
    *   No credentials, port, query, or fragment.
    *   Exactly `/owner/repository` path (exactly two non-empty segments, optional trailing slash and `.git` suffix normalized away).
    *   Repository owner must match the GitHub username case-insensitively.
    *   No duplicate normalized URLs.
    *   No gaps (e.g. URL 3 cannot exist if URL 2 is empty).
    *   One to three repositories total.

#### [NEW] [parsers.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/lib/parsers.ts)
Safely parses and validates JSON returned by View methods:
*   `parseRequestJson(jsonStr: string): VerificationRequest`
*   `parseAttestationsJson(jsonStr: string): Attestation[]`

---

### 3. GenLayer Integration & Wallet Context

#### [NEW] [network.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/config/network.ts)
Stores Studionet constants: RPC URL `https://studio.genlayer.com/api`, Chain ID `61999`, Explorer `https://explorer-studio.genlayer.com/`.

#### [NEW] [genlayer.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/lib/genlayer.ts)
Initializes:
*   **Read client**: `createClient({ chain: studionet })` to read from the contract without needing a wallet connected.
*   **Write client creator**: `createClient({ chain: studionet, account: address })` instantiated dynamically when a wallet is connected.

#### [NEW] [transactions.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/lib/transactions.ts)
Implements client status queries supporting both SDK camelCase and Studio snake_case fields.
Normalizes properties:
*   `statusName` or `status_name`
*   `resultName` or `result_name`
*   `consensus_data.leader_receipt`
*   `consensus_data.validators`
*   `execution_result`

**Exact Transaction Success Gate**:
*   A transaction is treated as successful ONLY when:
    1.  Normalized status is `FINALIZED`.
    2.  Normalized consensus result is `MAJORITY_AGREE`.
    3.  Authoritative leader/validator execution receipts do not contain any execution failures (status must be `SUCCESS`).
*   `ACCEPTED` must remain strictly as an in-progress/awaiting-finalization state.
*   If execution success cannot be proven, the UI must not show success (it should show "Finalized, execution result could not be verified").

**Deterministic Request ID Resolution**:
To identify the created request ID:
1.  Capture the `get_request_count` value immediately before submitting `request_verification`.
2.  Upon transaction finality, attempt to decode the returned request ID from the finalized transaction receipt if safely exposed by the SDK.
3.  If unavailable, read the post-submit request count.
4.  Scan only the newly created ID range (`[preSubmitCount + 1, postSubmitCount]`).
5.  Require the owner of the scanned request to match the connected wallet.
6.  Never assume the newest global request belongs to the current wallet; never guess a request ID.

#### [NEW] [WalletContext.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/context/WalletContext.tsx)
Context provider managing:
*   Detection of `window.ethereum`.
*   Account requesting via `eth_requestAccounts`.
*   Instantiation of connected GenLayer Client.
*   `client.connect("studionet")` connection/network switching checks.
*   EIP-1193 event listeners (`accountsChanged`, `chainChanged`) and cleanup.
*   Internal disconnect cleaning local React states.

#### [NEW] [useWallet.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/hooks/useWallet.ts)
Custom hook exposing the wallet context.

---

### 4. Shared UI Components (GitHub/Primer-Inspired Style)

#### [NEW] [styles.css](file:///E:/Genlayer-Projects/talentverify/frontend/src/styles.css)
Main CSS implementing the approved Visual Token System (neutrals, plain borders, card radius 12px, blue accent `#1769E0`). Suppress scroll animations for `prefers-reduced-motion`.

#### [NEW] [AppLayout.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/components/AppLayout.tsx)
Header, Main container, Sidebar routing layout with skip links.

#### [NEW] [Header.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/components/Header.tsx)
Displays title, disclaimer, wallet connection state, and navigation links.

#### [NEW] [WalletButton.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/components/WalletButton.tsx)
MetaMask connect button, switches network if wrong, renders user address with copy-option.

#### [NEW] [TransactionTimeline.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/components/TransactionTimeline.tsx)
Chronological visual map showing transaction state.
**Visual Transaction States (13 total)**:
*   `PENDING`
*   `PROPOSING`
*   `COMMITTING`
*   `REVEALING`
*   `ACCEPTED`
*   `READY_TO_FINALIZE`
*   `FINALIZED`
*   `CANCELED`
*   `UNDETERMINED`
*   `LEADER_TIMEOUT`
*   `VALIDATORS_TIMEOUT`
*   `APPEAL_COMMITTING`
*   `APPEAL_REVEALING`

#### [NEW] [VerdictBadge.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/components/VerdictBadge.tsx)
Visual tag for the four verdicts. Status meaning must never rely on color alone.
**Verdict Styling**:
*   `SUPPORTED`: success (green theme, check icon)
*   `INSUFFICIENT_EVIDENCE`: warning/neutral (yellow theme, info/help icon)
*   `NOT_SUPPORTED`: neutral/dangerous conclusion (orange/grey theme, cross icon)
*   `INCONCLUSIVE`: neutral/warning (grey theme, alert icon)
*   *Note: Do not use red to imply that INCONCLUSIVE is a frontend or transaction error.*

#### [NEW] [ErrorNotice.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/components/ErrorNotice.tsx)
Accessible panel with recovery actions.

#### [NEW] [LoadingState.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/components/LoadingState.tsx)
Sleek, fast spinner for loading.

#### [NEW] [EmptyState.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/components/EmptyState.tsx)
Renders a descriptive card for empty datasets.

---

### 5. Pages & Navigation Routing

#### [NEW] [App.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/App.tsx)
Configures route paths using React Router.

#### [NEW] [HomePage.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/pages/HomePage.tsx)
Home page displaying value proposition, verification disclaimers, contract network information, and a form to query any developer's credentials history by address.

#### [NEW] [VerifyPage.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/pages/VerifyPage.tsx)
Form for submitting skill and repositories. Performs validation on form fields, switch-chain checks, calls `request_verification`, monitors the transaction, and routes on completion.

#### [NEW] [RequestPage.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/pages/RequestPage.tsx)
Loads request data, displays repositories, status. Provides a connect-wallet trigger, and enables the owner to trigger `evaluate_request`. Displays verdict result, reasoning, and evidence summary once finalized.

#### [NEW] [CredentialsPage.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/pages/CredentialsPage.tsx)
Lists all finalized credentials for a wallet address from `get_attestations`, ordered newest-first.

#### [NEW] [NotFoundPage.tsx](file:///E:/Genlayer-Projects/talentverify/frontend/src/pages/NotFoundPage.tsx)
Wildcard route page with CTA back to Home.

---

### 6. Testing & Smoke Verification

#### [NEW] [setup.ts](file:///E:/Genlayer-Projects/talentverify/frontend/src/tests/setup.ts)
Initializes Jest DOM matcher libraries for Vitest compatibility.

#### [NEW] [smoke-read.mjs](file:///E:/Genlayer-Projects/talentverify/frontend/scripts/smoke-read.mjs)
Authoritative read-only CLI script executing `readContract` on `get_request_count` over Studionet using Node 22 `--env-file` support. Emits verification diagnostics and exits with `0` or `1`. It runs from the `frontend/` directory, uses `frontend/.env.local`, and performs no state-changing transactions.

---

## Verification Plan

All npm commands will be run from the `E:\Genlayer-Projects\talentverify\frontend` directory:

### Automated Tests
1.  **Dependency check**: `npm ls --depth=0`
2.  **Compilation & Types check**: `npm run typecheck`
3.  **Linter check**: `npm run lint`
4.  **Unit Tests**: `npm run test`
    *   *We will write explicit tests covering: transaction finality helper, ACCEPTED not being treated as success, FINALIZED + MAJORITY_AGREE + SUCCESS, execution failure, MAJORITY_DISAGREE, request ID resolution, malformed contract JSON, URL validation edge cases, disconnected wallet, wrong network, timeout/canceled/undetermined states, empty credential history, and long content (long URLs/reasons).*
5.  **Build check**: `npm run build`
6.  **Smoke-Read Check**: `npm run smoke:read` (runs `smoke-read.mjs` against live Studionet contract)

### Manual Verification
1.  Launch the Vite local server: `npm run dev`.
2.  Review in the browser at different breakpoints (375px, 390px, 768px, 1440px) to verify responsiveness.
3.  Verify MetaMask connection logic, chain-switching request, disconnected state, and contract validation errors.

---

## Blocker Correction Attempt 2 Updates

We successfully applied the following corrections to resolve independent audit blockers:
1. **ResourceNotFoundRpcError Retry Handling**:
   - `monitorTransaction` retries when encountering `ResourceNotFoundRpcError` up to `maxAttempts`.
   - Non-retryable errors reject immediately.
   - Cleans up all timers and abort listeners.
2. **Write Flow Abort Lifecycle**:
   - Added active monitor tracking ref (`activeAbortControllerRef`) in `VerifyPage.tsx` and `RequestPage.tsx`.
   - Aborts previous monitor before triggering new ones and aborts active monitors on component unmount.
   - State updates are bypassed if the monitor is aborted.
3. **Structured Context Validation**:
   - Extracted validation logic to `frontend/src/lib/pendingTransactions.ts` with type-safe guards.
   - Restored monitors validate chain ID, contract addresses, and wallet owners case-insensitively, handling errors without crashing.
4. **Removal of Broad `any`**:
   - Typed all `readClient`, `client`, `catch` blocks, and SDK client parameters using exact interfaces and return types.
5. **UI & Timeline Tests**:
   - Expanded Vitest test suites to 5 files and 71 test cases verifying timelines, page unmount aborts, parameter restoration, empty/error fallbacks, and long content wraps.
