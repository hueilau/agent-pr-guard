import { severityRank } from "./index.js";

export function reportJson(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function reportMarkdown(result) {
  const lines = ["# Agent PR Guard Report", ""];
  lines.push(summaryLine(result));
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("No findings.");
    return lines.join("\n");
  }

  lines.push("| Severity | Rule | Location | Finding | Recommendation |");
  lines.push("|---|---|---|---|---|");
  for (const finding of result.findings) {
    lines.push(`| ${finding.severity} | ${finding.rule} | ${finding.file}:${finding.line} | ${escapeMarkdown(finding.message)} | ${escapeMarkdown(finding.recommendation)} |`);
  }

  return lines.join("\n");
}

export function reportText(result) {
  const lines = [summaryLine(result)];

  if (result.findings.length === 0) {
    lines.push("No findings.");
    return lines.join("\n");
  }

  for (const finding of result.findings) {
    lines.push("");
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.rule}`);
    lines.push(`  ${finding.file}:${finding.line}`);
    lines.push(`  ${finding.message}`);
    lines.push(`  Fix: ${finding.recommendation}`);
  }

  return lines.join("\n");
}

function summaryLine(result) {
  const severityText = Object.keys(severityRank)
    .map((severity) => `${severity}: ${result.summary.bySeverity[severity]}`)
    .join(", ");

  return `Scanned ${result.summary.filesScanned} changed file(s); ${result.summary.totalFindings} finding(s) (${severityText}).`;
}

function escapeMarkdown(value) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
