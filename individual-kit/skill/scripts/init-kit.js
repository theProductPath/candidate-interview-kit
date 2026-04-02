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
  path.join(targetDir, "INTERVIEWER-NOTES-OPTIONAL.txt"),
  [
    "Optional interviewer notes",
    "",
    "Add focus areas, hiring manager guidance, or interviewer notes here if you want the skill",
    "to tailor prep briefs more precisely. This file can be replaced with a markdown, text, PDF,",
    "or Word document using a name like `interviewer-notes.*`, `hiring-manager-notes.*`,",
    "or `focus-areas.*`.",
    "",
    "The skill can proceed without this file, but the generated prep will be less tailored.",
  ].join("\n")
);
writeIfMissing(
  path.join(targetDir, "START-HERE.md"),
  [
    "# Candidate Interview Kit",
    "",
    "This folder is initialized and ready for use.",
    "",
    "## Required before the skill can run",
    "",
    "- Add a job description file to this folder.",
    "- Accepted examples: `job-description.md`, `jd.pdf`, `jd.docx`, or another clearly named JD file.",
    "",
    "## Optional but recommended",
    "",
    "- Add interviewer notes or focus areas.",
    "- Accepted examples: `interviewer-notes.md`, `hiring-manager-notes.docx`, `focus-areas.pdf`.",
    "",
    "## Next steps",
    "",
    "1. Put the JD file in this folder.",
    "2. Add any interviewer notes if you have them.",
    "3. Add a candidate with: `node skill/scripts/add-candidate.js \"Candidate Name\"`",
    "4. Refresh the comparison tool with: `node skill/scripts/refresh-comparison.js`",
  ].join("\n")
);

console.log(`Initialized kit in ${targetDir}`);
console.log(`Created: candidates/, SKILL.md, skill/, and startup guidance files.`);
console.log(`Next: add a job description file before generating briefs or refreshing the comparison tool.`);

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
