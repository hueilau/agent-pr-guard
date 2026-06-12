# Contributing

Thanks for helping make AI-assisted repositories safer.

## Local setup

```bash
npm test
npm run lint
```

The project has no runtime dependencies. Please keep new rules dependency-free unless there is a strong reason to add a package.

## Adding a rule

1. Add the rule logic in `src/index.js`.
2. Add a focused fixture in `test/scanner.test.js`.
3. Document the rule in `README.md`.

Good rules are high-signal, explainable, and easy for maintainers to override later.

## Scope

Agent PR Guard intentionally avoids MCP integrations, background services, and remote scanning. It should remain usable as a small CLI and GitHub Action.
