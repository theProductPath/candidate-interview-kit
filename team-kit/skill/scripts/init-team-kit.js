#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const targetDir = path.resolve(args[0] || process.cwd());
const sourceRoot = path.resolve(__dirname, "..", "..");
const sourceSkillMd = path.join(sourceRoot, "SKILL.md");
const sourceSkillDir = path.join(sourceRoot, "skill");

ensureDir(targetDir);
ensureDir(path.join(targetDir, "candidates"));
copyIfMissing(sourceSkillMd, path.join(targetDir, "SKILL.md"));
copyDirIfMissing(sourceSkillDir, path.join(targetDir, "skill"));

writeIfMissing(
  path.join(targetDir, "_team.md"),
  [
    "# Hiring Team",
    "**Role:** [Role Title]",
    "**Company:** [Company Name]",
    "**Hiring Manager:** [Hiring Manager Name]",
    "",
    "## [Interviewer Name] — [Title]",
    "**Role on team:** Hiring Manager",
    "**Focus areas:**",
    "- [What should this interviewer focus on?]",
    "- [What specific areas should they probe?]",
    "",
    "## [Interviewer Name] — [Title]",
    "**Focus areas:**",
    "- [What should this interviewer focus on?]",
    "- [What specific areas should they probe?]",
  ].join("\n")
);

writeIfMissing(
  path.join(targetDir, "START-HERE.md"),
  [
    "# Candidate Interview Kit — Team Edition",
    "",
    "This folder is initialized and ready for use.",
    "",
    "## Required before the skill can run",
    "",
    "- Add a job description file to this folder (e.g. `job-description.md`, `jd.pdf`).",
    "- Edit `_team.md` to define your hiring team — interviewers, titles, and focus areas.",
    "",
    "## Next steps",
    "",
    "1. Edit `_team.md` with your real interviewer roster and focus areas.",
    "2. Put the JD file in this folder.",
    "3. Add a candidate: `node skill/scripts/add-candidate.js \"Candidate Name\"`",
    "4. Add an interviewer: `node skill/scripts/add-interviewer.js \"Name\" \"Title\" --focus \"area1\"`",
    "5. Generate briefs, then assessments, then refresh the comparison tool.",
    "6. Refresh comparison: `node skill/scripts/refresh-comparison.js`",
  ].join("\n")
);

console.log(`Initialized team kit in ${targetDir}`);
console.log(`Created: candidates/, SKILL.md, skill/, _team.md, and startup guidance.`);
console.log(`Next: edit _team.md with your hiring team, then add a job description file.`);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyIfMissing(source, destination) {
  if (fs.existsSync(destination)) return;
  fs.copyFileSync(source, destination);
}

function copyDirIfMissing(sourceDir, destinationDir) {
  if (fs.existsSync(destinationDir)) return;
  fs.cpSync(sourceDir, destinationDir, { recursive: true });
}

function writeIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, content);
}
