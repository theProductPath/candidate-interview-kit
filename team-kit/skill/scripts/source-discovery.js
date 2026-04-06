const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const DOC_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".rtf"]);
const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...DOC_EXTENSIONS]);
const RESUME_BASENAMES = ["resume", "cv"];

const JOB_DESCRIPTION_BASENAMES = [
  "job-description", "job_description", "jd",
  "role-description", "role_description",
  "position-description", "position_description",
];

const TEAM_FILE_BASENAMES = ["_team"];

function discoverSources(kitRoot) {
  const files = fs
    .readdirSync(kitRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      name: entry.name,
      ext: path.extname(entry.name).toLowerCase(),
      base: path.basename(entry.name, path.extname(entry.name)).toLowerCase(),
      fullPath: path.join(kitRoot, entry.name),
    }))
    .filter((file) => SUPPORTED_EXTENSIONS.has(file.ext));

  const candidatesRoot = path.join(kitRoot, "candidates");
  const resumeFiles = [];
  if (fs.existsSync(candidatesRoot)) {
    for (const candidateEntry of fs.readdirSync(candidatesRoot, { withFileTypes: true })) {
      if (!candidateEntry.isDirectory()) continue;
      const candidateDir = path.join(candidatesRoot, candidateEntry.name);
      for (const candidateFile of fs.readdirSync(candidateDir, { withFileTypes: true })) {
        if (!candidateFile.isFile()) continue;
        const ext = path.extname(candidateFile.name).toLowerCase();
        const base = path.basename(candidateFile.name, path.extname(candidateFile.name)).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
        resumeFiles.push({
          name: candidateFile.name,
          ext,
          base,
          fullPath: path.join(candidateDir, candidateFile.name),
        });
      }
    }
  }

  return {
    jobDescription: pickSource(files, JOB_DESCRIPTION_BASENAMES, ["job", "description", "jd"]),
    teamFile: pickSource(files, TEAM_FILE_BASENAMES, ["_team", "team"]),
    resume: pickSource(resumeFiles, RESUME_BASENAMES, ["resume", "cv", "candidate"]),
  };
}

function pickSource(files, preferredBasenames, fallbackTerms) {
  const exact = files.find((file) => preferredBasenames.includes(file.base));
  if (exact) return exact;
  const fuzzy = files.find((file) => fallbackTerms.some((term) => file.base.includes(term)));
  if (fuzzy) return fuzzy;
  if (files.length === 1) return files[0];
  return null;
}

function readTextSource(source) {
  if (!source) return null;
  if (TEXT_EXTENSIONS.has(source.ext)) {
    return fs.readFileSync(source.fullPath, "utf8");
  }
  if (source.ext === ".pdf") {
    return runExtractor("/opt/homebrew/bin/pdftotext", ["-layout", source.fullPath, "-"]);
  }
  if (source.ext === ".docx" || source.ext === ".doc" || source.ext === ".rtf") {
    return runExtractor("/usr/bin/textutil", ["-convert", "txt", "-stdout", source.fullPath]);
  }
  return null;
}

function validateKitPrereqs(kitRoot) {
  const sources = discoverSources(kitRoot);
  const errors = [];
  const warnings = [];

  if (!sources.jobDescription) {
    errors.push("No job description file found. Add a file like `job-description.md` or `jd.pdf` in the kit root.");
  }
  if (!sources.teamFile) {
    errors.push("No `_team.md` file found. The team kit requires a hiring team definition file.");
  }

  return { sources, errors, warnings };
}

module.exports = { discoverSources, readTextSource, validateKitPrereqs };

function runExtractor(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
