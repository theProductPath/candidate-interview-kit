#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildKitData } = require("./kit-data");
const { validateKitPrereqs } = require("./source-discovery");

const args = process.argv.slice(2);
const cwd = process.cwd();
const kitRoot = path.resolve(args[0] || cwd);
const templatePath = path.resolve(__dirname, "../assets/comparison-template.html");
const outputPath = path.join(kitRoot, "comparison.html");

if (!fs.existsSync(path.join(kitRoot, "candidates"))) {
  console.error(`No candidates directory found in ${kitRoot}`);
  process.exit(1);
}

const prereqs = validateKitPrereqs(kitRoot);
if (prereqs.errors.length) {
  prereqs.errors.forEach((error) => console.error(error));
  process.exit(1);
}
prereqs.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

const template = fs.readFileSync(templatePath, "utf8");
const data = buildKitData(kitRoot);
const html = template.replace(
  "__COMPARISON_DATA__",
  JSON.stringify(data, null, 2)
);

fs.writeFileSync(outputPath, html);

console.log(
  `Updated ${outputPath} with ${data.counts.total} candidates (${data.counts.assessed} assessed, ${data.counts.pending} pending, ${data.counts.notStarted} not started).`
);
