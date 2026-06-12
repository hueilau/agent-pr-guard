import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { reportJson, reportMarkdown, reportText } from "./reporters.js";
import { compareSeverity, normalizeSeverity, scanDiff } from "./index.js";

const help = `agent-pr-guard

Usage:
  agent-pr-guard scan [--base <ref>] [--head <ref>] [--diff <file>] [--format text|markdown|json] [--fail-on low|medium|high|critical|off]

Examples:
  agent-pr-guard scan --base origin/main --head HEAD
  git diff origin/main...HEAD | agent-pr-guard scan --format markdown
  agent-pr-guard scan --diff pr.diff --fail-on high
`;

export async function runCli(argv) {
  const command = argv[0] || "scan";

  if (command === "--help" || command === "-h" || command === "help") {
    console.log(help.trim());
    return;
  }

  if (command !== "scan") {
    throw new Error(`Unknown command: ${command}\n\n${help}`);
  }

  const options = parseArgs(argv.slice(1));
  const diff = readDiff(options);
  const result = scanDiff(diff);
  const output = formatReport(result, options.format);

  if (output) {
    console.log(output);
  }

  const failOn = normalizeSeverity(options.failOn);
  if (failOn && result.findings.some((finding) => compareSeverity(finding.severity, failOn) >= 0)) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    base: process.env.PR_GUARD_BASE || process.env.INPUT_BASE || process.env.GITHUB_BASE_REF || "origin/main",
    head: process.env.PR_GUARD_HEAD || process.env.INPUT_HEAD || process.env.GITHUB_SHA || "HEAD",
    diffFile: "",
    failOn: process.env.PR_GUARD_FAIL_ON || process.env.INPUT_FAIL_ON || "high",
    format: process.env.PR_GUARD_FORMAT || process.env.INPUT_FORMAT || "text"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--base") {
      options.base = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--head") {
      options.head = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--diff") {
      options.diffFile = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--format") {
      options.format = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--fail-on") {
      options.failOn = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(help.trim());
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!["text", "markdown", "json"].includes(options.format)) {
    throw new Error("--format must be one of: text, markdown, json");
  }

  normalizeSeverity(options.failOn);
  return options;
}

function requiredValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function readDiff(options) {
  if (options.diffFile) {
    if (!existsSync(options.diffFile)) {
      throw new Error(`Diff file does not exist: ${options.diffFile}`);
    }
    return readFileSync(options.diffFile, "utf8");
  }

  if (!process.stdin.isTTY) {
    const piped = readFileSync(0, "utf8");
    if (piped.trim()) {
      return piped;
    }
  }

  const range = `${options.base}...${options.head}`;
  try {
    return execFileSync("git", ["diff", "--no-ext-diff", "--unified=0", range], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const details = error.stderr?.toString().trim();
    throw new Error(`Unable to read git diff for ${range}${details ? `: ${details}` : ""}`);
  }
}

function formatReport(result, format) {
  if (format === "json") {
    return reportJson(result);
  }
  if (format === "markdown") {
    return reportMarkdown(result);
  }
  return reportText(result);
}
