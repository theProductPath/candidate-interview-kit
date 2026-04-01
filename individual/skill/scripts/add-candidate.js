#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { slugifyCandidateName } = require("./kit-data");

const args = process.argv.slice(2);
const name = args.join(" ").trim();

if (!name) {
  console.error("Usage: node individual/skill/scripts/add-candidate.js \"Candidate Name\"");
  process.exit(1);
}

const kitRoot = process.cwd();
const candidatesRoot = path.join(kitRoot, "candidates");
const slug = slugifyCandidateName(name);
const candidateDir = path.join(candidatesRoot, slug);

if (!fs.existsSync(candidatesRoot)) {
  fs.mkdirSync(candidatesRoot, { recursive: true });
}

if (!fs.existsSync(candidateDir)) {
  fs.mkdirSync(candidateDir, { recursive: true });
}

console.log(`Candidate folder ready at ${candidateDir}`);
