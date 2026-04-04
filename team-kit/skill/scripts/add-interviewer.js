#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { slugify } = require("./kit-data");

const args = process.argv.slice(2);

// Parse arguments
let name = "";
let title = "";
let isHiringManager = false;
const focusAreas = [];

let i = 0;
while (i < args.length) {
  if (args[i] === "--hiring-manager") {
    isHiringManager = true;
    i++;
  } else if (args[i] === "--focus" && i + 1 < args.length) {
    focusAreas.push(args[i + 1]);
    i += 2;
  } else if (!name) {
    name = args[i];
    i++;
  } else if (!title) {
    title = args[i];
    i++;
  } else {
    i++;
  }
}

if (!name || !title) {
  console.error('Usage: node skill/scripts/add-interviewer.js "Full Name" "Title" [--hiring-manager] [--focus "area1" --focus "area2"]');
  process.exit(1);
}

const kitRoot = process.cwd();
const teamFilePath = path.join(kitRoot, "_team.md");

if (!fs.existsSync(teamFilePath)) {
  console.error("No _team.md found in kit root. Run init-team-kit.js first.");
  process.exit(1);
}

const teamContent = fs.readFileSync(teamFilePath, "utf8");
const slug = slugify(name);

// Check for duplicate
if (teamContent.includes(`## ${name}`) || teamContent.includes(`/${slug}/`)) {
  console.error(`Interviewer "${name}" already exists in _team.md.`);
  process.exit(1);
}

// Build new section
let section = `\n\n## ${name} — ${title}`;
if (isHiringManager) {
  section += `\n**Role on team:** Hiring Manager`;
}
section += `\n**Focus areas:**`;
if (focusAreas.length > 0) {
  focusAreas.forEach((area) => {
    section += `\n- ${area}`;
  });
} else {
  section += `\n- [What should this interviewer focus on?]`;
  section += `\n- [What specific areas should they probe?]`;
}
section += "\n";

fs.appendFileSync(teamFilePath, section);
console.log(`Added interviewer "${name}" (${title}) to _team.md.`);
