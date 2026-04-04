#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildTeamKitData } = require("./kit-data");
const { validateKitPrereqs } = require("./source-discovery");

const args = process.argv.slice(2);
const cwd = process.cwd();
const kitRoot = path.resolve(args[0] || cwd);
const templatePath = path.resolve(__dirname, "../assets/comparison-team-template.html");
const outputPath = path.join(kitRoot, "comparison.html");

if (!fs.existsSync(path.join(kitRoot, "candidates"))) {
  console.error(`No candidates directory found in ${kitRoot}`);
  process.exit(1);
}

const prereqs = validateKitPrereqs(kitRoot);
if (prereqs.errors.length) {
  prereqs.errors.forEach((e) => console.error(e));
  process.exit(1);
}
prereqs.warnings.forEach((w) => console.warn(`Warning: ${w}`));

const template = fs.readFileSync(templatePath, "utf8");
const data = buildTeamKitData(kitRoot);
const html = template.replace("__COMPARISON_DATA__", JSON.stringify(data, null, 2));

fs.writeFileSync(outputPath, html);

const assessed = data.candidates.filter((c) => c.status === "assessed").length;
const partial = data.candidates.filter((c) => c.status === "partial").length;
const pending = data.candidates.filter((c) => c.status === "pending").length;
const notStarted = data.candidates.filter((c) => c.status === "not-started").length;

console.log(`Updated ${outputPath} with ${data.candidates.length} candidates (${assessed} assessed, ${partial} partial, ${pending} pending, ${notStarted} not started).`);
console.log(`Team: ${data.interviewers.length} interviewers.`);
