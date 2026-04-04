#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { slugify } = require("./kit-data");

const args = process.argv.slice(2);
const name = args.join(" ").trim();

if (!name) {
  console.error('Usage: node team-kit/skill/scripts/add-candidate.js "Candidate Name"');
  process.exit(1);
}

const kitRoot = process.cwd();
const candidatesRoot = path.join(kitRoot, "candidates");
const slug = slugify(name);
const candidateDir = path.join(candidatesRoot, slug);

if (!fs.existsSync(candidatesRoot)) {
  fs.mkdirSync(candidatesRoot, { recursive: true });
}

if (!fs.existsSync(candidateDir)) {
  fs.mkdirSync(candidateDir, { recursive: true });
}

console.log(`Candidate folder ready at ${candidateDir}`);

try {
  const refreshScript = path.join(__dirname, "refresh-comparison.js");
  const output = execFileSync(process.execPath, [refreshScript], {
    cwd: kitRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (output) console.log(output);
} catch (error) {
  const detail = (error.stderr ? String(error.stderr).trim() : "") || (error.stdout ? String(error.stdout).trim() : "");
  console.warn(detail ? `Comparison refresh skipped: ${detail}` : "Comparison refresh skipped.");
}
