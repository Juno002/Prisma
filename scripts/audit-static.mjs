import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["client/src", "client/index.html", "client/public"];
const banned = [
  { label: "network call", pattern: /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/gi },
  { label: "remote URL", pattern: /https?:\/\//gi },
  { label: "analytics", pattern: /analytics|telemetry|umami|segment|mixpanel/gi },
  { label: "AI endpoint", pattern: /ai-insight|openai|anthropic|gemini|llm/gi },
  { label: "API endpoint", pattern: /\/api\b|remotePatterns|VITE_.*(API|URL)/gi },
];

function filesIn(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? filesIn(child) : [child];
  });
}

const files = roots.flatMap(filesIn).filter((file) => !file.endsWith(".map"));
const violations = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of banned) {
      if (rule.pattern.test(line)) {
        violations.push(`${file}:${index + 1}: ${rule.label}: ${line.trim()}`);
        rule.pattern.lastIndex = 0;
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Static privacy audit failed:");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log(`Static privacy audit passed (${files.length} files scanned).`);
