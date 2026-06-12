# Agent PR Guard

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](package.json)
[![No runtime dependencies](https://img.shields.io/badge/runtime_deps-0-brightgreen.svg)](package.json)
[![MCP-free](https://img.shields.io/badge/MCP-free-black.svg)](#why-agent-pr-guard)

Catch risky AI-assisted pull requests before they quietly become supply-chain incidents.

Agent PR Guard is a small, dependency-free CLI and GitHub Action for reviewing the parts of a PR that are easiest to miss when code is generated quickly: GitHub Actions permissions, secret leakage, remote script execution, install-time package scripts, lockfile churn, and agent instruction changes.

```bash
node ./bin/agent-pr-guard.js scan --base origin/main --head HEAD
```

```text
Scanned 2 changed file(s); 3 finding(s) (info: 0, low: 0, medium: 1, high: 1, critical: 1).

[CRITICAL] secret-egress
  .github/workflows/release.yml:42
  Line appears to echo or read a secret value.
  Fix: Remove secret output and pass credentials only to the command that needs them.

[HIGH] remote-script-execution
  .github/workflows/release.yml:31
  Remote download is piped directly into an interpreter.
  Fix: Download, checksum, inspect, and execute pinned artifacts instead of piping remote code to a shell.
```

## Why Agent PR Guard

AI coding tools make repository changes faster. They also make it easier for a risky workflow edit, dependency hook, or instruction-file change to blend into an otherwise normal PR.

Agent PR Guard is built for maintainers who want a quick second set of eyes without adding a SaaS scanner, a background service, or a framework dependency.

- **Fast to try**: one local command against a git diff.
- **Easy to reason about**: simple rules with plain-English fixes.
- **CI-friendly**: fails on `high` and `critical` findings by default.
- **Private by default**: reads local diffs and sends nothing anywhere.
- **Dependency-free**: no runtime npm packages.
- **MCP-free by design**: no MCP server, browser-control bridge, daemon, or remote tool surface.

## Install

Clone the project:

```bash
git clone https://github.com/hueilau/agent-pr-guard.git
cd agent-pr-guard
npm test
```

Run it against your current branch:

```bash
node ./bin/agent-pr-guard.js scan --base origin/main --head HEAD
```

Run it against a saved diff:

```bash
git diff origin/main...HEAD > pr.diff
node ./bin/agent-pr-guard.js scan --diff pr.diff --format markdown
```

Pipe a diff directly:

```bash
git diff origin/main...HEAD | node ./bin/agent-pr-guard.js scan --format json
```

## GitHub Action

Use Agent PR Guard in another repository:

```yaml
name: pr-guard

on:
  pull_request:

permissions:
  contents: read

jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8
        with:
          fetch-depth: 0
      - uses: hueilau/agent-pr-guard@v0
        with:
          base: origin/main
          head: HEAD
          fail-on: high
```

`fail-on` accepts `low`, `medium`, `high`, `critical`, or `off`.

## What It Catches

| Rule | Severity | Catches | Why it matters |
|---|---:|---|---|
| `secret-egress` | critical | Printing or reading secret-bearing values in CI logs. | Secrets can leak through build output even when code looks harmless. |
| `remote-script-execution` | high | `curl` or `wget` piped directly to an interpreter. | Remote code can change after review and execute inside CI. |
| `pull-request-target` | high | Elevated GitHub Actions triggers on pull requests. | Untrusted PR code can reach privileged workflow contexts if misused. |
| `write-all-permissions` | high | Broad workflow write permissions. | Over-broad tokens turn small workflow bugs into repo-wide risk. |
| `package-lifecycle-script` | medium-high | New `preinstall`, `install`, `postinstall`, or `prepare` scripts. | Lifecycle scripts run automatically during dependency installation. |
| `unpinned-action` | medium-high | Third-party actions not pinned to a full commit SHA. | Tags and branches can move after review. |
| `write-permission` | medium | Write scopes in workflow permissions. | Write access should be deliberate and tied to trusted events. |
| `large-lockfile-change` | low | Big lockfile diffs. | Dependency churn deserves provenance review. |
| `agent-instruction-change` | low | Changes to `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, and similar files. | Instruction changes can alter how future AI-generated work behaves. |

## CLI

```text
agent-pr-guard scan [--base <ref>] [--head <ref>] [--diff <file>] [--format text|markdown|json] [--fail-on low|medium|high|critical|off]
```

| Option | Default | Description |
|---|---|---|
| `--base` | `origin/main` | Base git ref for the diff. |
| `--head` | `HEAD` | Head git ref for the diff. |
| `--diff` | none | Read a saved unified diff instead of running `git diff`. |
| `--format` | `text` | Output `text`, `markdown`, or `json`. |
| `--fail-on` | `high` | Exit with code `1` at or above this severity. Use `off` for advisory mode. |

## Good First Contributions

This project is intentionally small, so useful contributions do not need a big setup.

- Add a high-signal rule with a tiny fixture.
- Improve a finding message or recommendation.
- Add SARIF output.
- Add markdown PR comment output.
- Add examples for Python, Go, Dockerfile, or Terraform risk patterns.
- Report false positives with a minimal synthetic diff.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Roadmap

- Config file support for rule overrides.
- SARIF output for GitHub code scanning.
- PR comment mode for GitHub Actions.
- Rule packs for Python, Go, Docker, Terraform, and package managers.
- Release tags once the first external fixtures land.

## Security

Agent PR Guard reads git diffs locally. It does not upload source code, store findings remotely, or run a background service.

Please report security issues privately. See [SECURITY.md](SECURITY.md).

## License

MIT
