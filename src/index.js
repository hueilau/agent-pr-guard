export const severityRank = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function normalizeSeverity(value) {
  if (value === "off" || value === false || value == null) {
    return null;
  }
  const normalized = String(value).toLowerCase();
  if (!(normalized in severityRank)) {
    throw new Error("Severity must be one of: low, medium, high, critical, off");
  }
  return normalized;
}

export function compareSeverity(left, right) {
  return severityRank[left] - severityRank[right];
}

export function scanDiff(diff) {
  const files = parseUnifiedDiff(diff);
  const findings = [];

  for (const file of files) {
    findings.push(...scanFilePatch(file));
  }

  return {
    summary: summarize(findings, files),
    findings: findings.sort((a, b) => {
      const severity = severityRank[b.severity] - severityRank[a.severity];
      if (severity !== 0) return severity;
      return `${a.file}:${a.line}:${a.rule}`.localeCompare(`${b.file}:${b.line}:${b.rule}`);
    })
  };
}

export function parseUnifiedDiff(diff) {
  const files = [];
  let current = null;
  let newLine = 0;

  for (const rawLine of diff.split(/\r?\n/)) {
    const gitHeader = rawLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (gitHeader) {
      current = {
        file: gitHeader[2],
        added: []
      };
      files.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    const newFileHeader = rawLine.match(/^\+\+\+ b\/(.+)$/);
    if (newFileHeader) {
      current.file = newFileHeader[1];
      continue;
    }

    const hunk = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }

    if (rawLine.startsWith("+++") || rawLine.startsWith("---")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      current.added.push({
        line: newLine || 1,
        text: rawLine.slice(1)
      });
      if (newLine) newLine += 1;
      continue;
    }

    if (rawLine.startsWith("-")) {
      continue;
    }

    if (rawLine.startsWith(" ") && newLine) {
      newLine += 1;
    }
  }

  return files.filter((file) => file.added.length > 0);
}

function scanFilePatch(file) {
  const findings = [];
  const fileName = file.file;

  for (const addedLine of file.added) {
    const text = stripInlineComment(addedLine.text);

    if (isWorkflow(fileName)) {
      findings.push(...scanWorkflowLine(fileName, addedLine.line, text));
    }

    findings.push(...scanGeneralLine(fileName, addedLine.line, text));

    if (isPackageJson(fileName)) {
      findings.push(...scanPackageJsonLine(fileName, addedLine.line, text));
    }

    if (isAgentInstruction(fileName)) {
      findings.push(finding({
        rule: "agent-instruction-change",
        severity: "low",
        file: fileName,
        line: addedLine.line,
        message: "Agent instruction file changed; review for prompt-injection or policy bypass instructions.",
        recommendation: "Require a maintainer review for changes to repository-level AI or coding-agent instructions."
      }));
    }
  }

  if (isLockfile(fileName) && file.added.length > 20) {
    findings.push(finding({
      rule: "large-lockfile-change",
      severity: "low",
      file: fileName,
      line: file.added[0]?.line || 1,
      message: "Large lockfile change detected.",
      recommendation: "Confirm the dependency update is intentional and review package provenance before merge."
    }));
  }

  return dedupeFindings(findings);
}

function scanWorkflowLine(file, line, text) {
  const findings = [];

  if (/\bpull_request_target\b/.test(text)) {
    findings.push(finding({
      rule: "pull-request-target",
      severity: "high",
      file,
      line,
      message: "Workflow uses pull_request_target, which runs with elevated permissions on pull requests.",
      recommendation: "Use pull_request when possible, or isolate untrusted checkout and restrict permissions tightly."
    }));
  }

  if (/^\s*permissions:\s*write-all\s*$/i.test(text)) {
    findings.push(finding({
      rule: "write-all-permissions",
      severity: "high",
      file,
      line,
      message: "Workflow grants write-all permissions.",
      recommendation: "Use explicit least-privilege permissions for each job."
    }));
  }

  if (/^\s*(contents|actions|checks|deployments|issues|packages|pull-requests|repository-projects|statuses):\s*write\s*$/i.test(text)) {
    findings.push(finding({
      rule: "write-permission",
      severity: "medium",
      file,
      line,
      message: "Workflow grants a write permission.",
      recommendation: "Confirm this write scope is required and scoped to trusted events only."
    }));
  }

  const action = text.match(/^\s*uses:\s*([^#\s]+)\s*$/i);
  if (action) {
    const reference = action[1];
    const atIndex = reference.lastIndexOf("@");

    if (reference.startsWith("./") || reference.startsWith("docker://")) {
      return findings;
    }

    if (atIndex === -1) {
      findings.push(finding({
        rule: "unpinned-action",
        severity: "high",
        file,
        line,
        message: `Action ${reference} is missing a pinned ref.`,
        recommendation: "Pin third-party actions to a full commit SHA."
      }));
    } else {
      const ref = reference.slice(atIndex + 1);
      if (!/^[a-f0-9]{40}$/i.test(ref)) {
        findings.push(finding({
          rule: "unpinned-action",
          severity: "medium",
          file,
          line,
          message: `Action ${reference} is not pinned to a full commit SHA.`,
          recommendation: "Pin third-party actions to a full commit SHA instead of a tag or branch."
        }));
      }
    }
  }

  return findings;
}

function scanGeneralLine(file, line, text) {
  const findings = [];

  if (/(curl|wget)\b[^|;&]*(\|\s*(bash|sh|zsh|python|node)\b)/i.test(text)) {
    findings.push(finding({
      rule: "remote-script-execution",
      severity: "high",
      file,
      line,
      message: "Remote download is piped directly into an interpreter.",
      recommendation: "Download, checksum, inspect, and execute pinned artifacts instead of piping remote code to a shell."
    }));
  }

  if (/\b(env|printenv)\b/.test(text) && /(secrets\.|GITHUB_TOKEN|NPM_TOKEN|AWS_|OPENAI_API_KEY|ANTHROPIC_API_KEY|DATABASE_URL)/.test(text)) {
    findings.push(finding({
      rule: "secret-egress",
      severity: "critical",
      file,
      line,
      message: "Line appears to print or expose secret-bearing environment values.",
      recommendation: "Do not print secrets or broad environment dumps in CI logs."
    }));
  }

  if (/\b(echo|printf|cat)\b.*(\$\{\{\s*secrets\.|GITHUB_TOKEN|NPM_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|DATABASE_URL)/.test(text)) {
    findings.push(finding({
      rule: "secret-egress",
      severity: "critical",
      file,
      line,
      message: "Line appears to echo or read a secret value.",
      recommendation: "Remove secret output and pass credentials only to the command that needs them."
    }));
  }

  return findings;
}

function scanPackageJsonLine(file, line, text) {
  const lifecycle = text.match(/"(preinstall|install|postinstall|prepare)"\s*:/);
  if (!lifecycle) {
    return [];
  }

  return [finding({
    rule: "package-lifecycle-script",
    severity: lifecycle[1] === "postinstall" || lifecycle[1] === "preinstall" ? "high" : "medium",
    file,
    line,
    message: `package.json adds a ${lifecycle[1]} lifecycle script.`,
    recommendation: "Review lifecycle scripts carefully; they run automatically during dependency installation."
  })];
}

function finding(input) {
  return {
    rule: input.rule,
    severity: input.severity,
    file: input.file,
    line: input.line,
    message: input.message,
    recommendation: input.recommendation
  };
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((item) => {
    const key = `${item.rule}:${item.file}:${item.line}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarize(findings, files) {
  const counts = Object.fromEntries(Object.keys(severityRank).map((severity) => [severity, 0]));
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }

  return {
    filesScanned: files.length,
    totalFindings: findings.length,
    bySeverity: counts
  };
}

function stripInlineComment(text) {
  return text.replace(/\s+#.*$/, "");
}

function isWorkflow(file) {
  return /^\.github\/workflows\/.+\.ya?ml$/i.test(file);
}

function isPackageJson(file) {
  return /(^|\/)package\.json$/i.test(file);
}

function isLockfile(file) {
  return /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i.test(file);
}

function isAgentInstruction(file) {
  return /(^|\/)(AGENTS\.md|CLAUDE\.md|GEMINI\.md|\.cursorrules|\.cursor\/rules\/.+|\.github\/copilot-instructions\.md)$/i.test(file);
}
