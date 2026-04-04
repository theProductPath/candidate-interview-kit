#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { slugify } = require("./kit-data");

const args = process.argv.slice(2);
const oldName = (args[0] || "").trim();
const newName = (args[1] || "").trim();

if (!oldName || !newName) {
  console.error('Usage: node skill/scripts/rename-candidate.js "Old Name" "New Name"');
  process.exit(1);
}

const kitRoot = process.cwd();
const candidatesRoot = path.join(kitRoot, "candidates");
const oldSlug = slugify(oldName);
const newSlug = slugify(newName);
const oldDir = path.join(candidatesRoot, oldSlug);
const newDir = path.join(candidatesRoot, newSlug);

if (!fs.existsSync(oldDir)) {
  console.error(`Candidate folder not found: ${oldDir}`);
  process.exit(1);
}

if (fs.existsSync(newDir)) {
  console.error(`Target candidate folder already exists: ${newDir}`);
  process.exit(1);
}

// Rename the candidate folder (interviewer subfolders move with it)
fs.renameSync(oldDir, newDir);

// Update title lines in all brief.md and assessment.md files in interviewer subfolders
const interviewerDirs = fs.readdirSync(newDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => path.join(newDir, e.name));

for (const ivDir of interviewerDirs) {
  updateFile(path.join(ivDir, "brief.md"), /^# Interview Prep Brief — .+$/m, `# Interview Prep Brief — ${newName}`);
  updateFile(path.join(ivDir, "assessment.md"), /^# Interview Assessment — .+$/m, `# Interview Assessment — ${newName}`);
}

console.log(`Renamed candidate folder from ${oldSlug} to ${newSlug}`);

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

function updateFile(filePath, pattern, replacement) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, content.replace(pattern, replacement));
}
