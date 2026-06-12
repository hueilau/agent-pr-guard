# Security Policy

Please report security issues privately by opening a GitHub security advisory on this repository.

Do not include live secrets or private repository data in public issues. A minimal synthetic diff is enough for most reports.

## Design notes

Agent PR Guard reads local git diffs and does not send code or findings to a remote service. It has no runtime npm dependencies and does not start an MCP server or any other tool bridge.
