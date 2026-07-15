# TalentVerify — Phase 1: Intelligent Contract

TalentVerify is an evidence-backed skill attestation system built on GenLayer. It allows developers to verify their proficiency in specific programming skills based on public evidence gathered from up to three GitHub repositories.

## ⚠️ Important Disclaimers & Project Boundary
- **No Identity Verification**: TalentVerify does NOT verify real-world identities, GitHub account ownership, or authorship of code. It only checks if the public repositories submitted support the claimed skill.
- **No Employment Proof**: This tool does not verify employment history, professional status, or make hiring recommendations.
- **Studionet Target Only**: The project is configured strictly for GenLayer Studionet (RPC: `https://studio.genlayer.com/api`, Chain ID: `61999`, Explorer: `https://explorer-studio.genlayer.com/`).
- **Current Status**: **DEPLOYED ON STUDIONET**
  - **Contract Address**: `0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14`
  - **Deployment Transaction Hash**: `0xf87ff6c3ce9562d99d36ca6f36dd2b2c92792c5e9274d10017f295d55a8bab4c`

---

## Supported Skills & Verdicts
### Allowed Skills
- `React`
- `TypeScript`
- `Python`
- `Solidity`
- `Rust`

### Allowed Verdicts
- `SUPPORTED`: Public evidence supports the skill claim.
- `INSUFFICIENT_EVIDENCE`: Public evidence is too weak or incomplete to draw a conclusion.
- `NOT_SUPPORTED`: Public evidence contradicts the skill claim.
- `INCONCLUSIVE`: Evidence is unavailable, malformed, or unsafe to assess.

---

## Technical Architecture
- **Contract Language**: Python using GenLayer Intelligent Contract syntax.
- **Contract Entry Point**: `contracts/talent_verify.py` containing exactly one subclass of `gl.Contract` named `TalentVerify`.
- **Decisions**: Executed non-deterministically via consensus among AI validators on-chain using the Equivalence Principle.

---

## Official Development Toolchain
- **Python Baseline**: `3.12.13`
- **genvm-linter**: `0.11.0`
- **genlayer-test**: `0.29.2`
- **pyright**: `1.1.411`
- **GenVM Dependency**: `v0.3.0-rc7` (resolved through linter)

---

## Local Verification & Testing
Local verification is performed using Pytest in **Direct Mode**, which executes the Intelligent Contract code in-memory on the Python runner without needing a live network or local Docker setup.

> [!WARNING]
> **Direct Mode Limitations**: Direct Mode simulates local in-process execution, storage slot updates, and mock responses. It **cannot** test multi-validator active consensus coordination, network latencies, or real-world LLM and web retrieval behavior.

### 1. Running Python Compilation Check
Verify all python source files compile cleanly:
```powershell
.\.venv-review\Scripts\python.exe -m compileall contracts tests
```

### 2. Running Official Linters and Typecheck
Verify syntax, storage rules, and typings statically:
```powershell
# 1. Genvm-lint lint check
.\.venv-review\Scripts\genvm-lint.exe lint contracts\talent_verify.py --json

# 2. Genvm-lint validation check
.\.venv-review\Scripts\genvm-lint.exe validate contracts\talent_verify.py --json

# 3. Genvm-lint full status check
.\.venv-review\Scripts\genvm-lint.exe check contracts\talent_verify.py --json

# 4. Genvm-lint schema extraction
.\.venv-review\Scripts\genvm-lint.exe schema contracts\talent_verify.py --json

# 5. Genvm-lint static type checking (requires UTF-8 encoding environment variable on Windows)
$env:PYTHONIOENCODING = "utf-8"; $env:PATH = "E:\Genlayer-Projects\talentverify\.venv-review\Scripts;" + $env:PATH; .\.venv-review\Scripts\genvm-lint.exe typecheck contracts\talent_verify.py --all
```

### 3. Running Pytest Direct Mode Suite
Execute the test suite containing **44 test methods** covering **57 validation scenarios** (input logic, edge cases, HTTP errors, and consensus states):
```powershell
.\.venv-review\Scripts\pytest.exe tests\ -v
```
