# Agent PR Guard

Dependency-free PR risk scanning for AI-assisted repositories.

Agent PR Guard is a tiny CLI and GitHub Action that catches risky pull request changes before they become quiet supply-chain problems. It focuses on the boring, high-signal checks maintainers already care about: GitHub Actions hardening, secret egress, remote script execution, dependency lifecycle scripts, and repository-level agent instruction changes.

It is intentionally MCP-free: no MCP server, no browser-control bridge, no background daemon, and no remote service.

## Why this project

The research points to durable demand around agent security and governance, but many of the highest-scoring ideas depend on MCP or browser-agent infrastructure. This project chooses the simpler wedge: help maintainers review AI-generated PRs and workflow changes with a tool they can run in any repository in minutes.

## Install

Run from the repository:

```bash
npm test
node ./bin/agent-pr-guard.js scan --base origin/main --head HEAD
```

Run against a saved diff:

```bash
git diff origin/main...HEAD > pr.diff
node ./bin/agent-pr-guard.js scan --diff pr.diff --format markdown
```

## GitHub Action

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

## Checks

| Rule | Severity | What it catches |
|---|---:|---|
| `secret-egress` | critical | Printing or reading secret-bearing values in CI logs. |
| `remote-script-execution` | high | `curl` or `wget` piped directly to an interpreter. |
| `pull-request-target` | high | Elevated GitHub Actions triggers on pull requests. |
| `write-all-permissions` | high | Broad workflow write permissions. |
| `package-lifecycle-script` | medium-high | New install-time package scripts. |
| `unpinned-action` | medium-high | Third-party actions not pinned to a full commit SHA. |
| `write-permission` | medium | Write scopes in workflow permissions. |
| `large-lockfile-change` | low | Big lockfile diffs that deserve provenance review. |
| `agent-instruction-change` | low | Changes to files such as `AGENTS.md`, `CLAUDE.md`, or `.github/copilot-instructions.md`. |

## CLI

```text
agent-pr-guard scan [--base <ref>] [--head <ref>] [--diff <file>] [--format text|markdown|json] [--fail-on low|medium|high|critical|off]
```

By default the CLI fails on `high` and above. Use `--fail-on off` for advisory-only reports.

## Roadmap

- PR comment mode for GitHub Actions.
- SARIF output for GitHub code scanning.
- Config file support for rule overrides.
- More ecosystem rules for Python, Go, and container builds.
- Maintainer-friendly example fixtures for testing new rules.

## Contributing

Small rules, focused fixtures, and clear false-positive reports are the best first contributions. See [CONTRIBUTING.md](CONTRIBUTING.md).
