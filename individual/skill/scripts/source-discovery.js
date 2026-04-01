const fs = require("fs");
const path = require("path");

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const DOC_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".rtf"]);
const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...DOC_EXTENSIONS]);

const JOB_DESCRIPTION_BASENAMES = [
  "job-description",
  "job_description",
  "jd",
  "role-description",
  "role_description",
  "position-description",
  "position_description",
];

const INTERVIEWER_NOTES_BASENAMES = [
  "interviewer-notes",
  "interviewer_notes",
  "hiring-manager-notes",
  "hiring_manager_notes",
  "focus-areas",
  "focus_areas",
  "interview-focus",
  "interview_focus",
];

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

  return {
    jobDescription: pickSource(files, JOB_DESCRIPTION_BASENAMES, ["job", "description", "jd"]),
    interviewerNotes: pickSource(files, INTERVIEWER_NOTES_BASENAMES, ["interviewer", "notes", "focus"]),
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
  if (!TEXT_EXTENSIONS.has(source.ext)) return null;
  return fs.readFileSync(source.fullPath, "utf8");
}

function validateKitPrereqs(kitRoot) {
  const sources = discoverSources(kitRoot);
  const errors = [];
  const warnings = [];

  if (!sources.jobDescription) {
    errors.push(
      "No job description file found. Add a file like `job-description.md`, `jd.pdf`, or another obvious JD file in the kit root."
    );
  }

  if (!sources.interviewerNotes) {
    warnings.push(
      "No interviewer notes file found. The skill can proceed, but prep briefs will be less tailored."
    );
  }

  return { sources, errors, warnings };
}

module.exports = {
  discoverSources,
  readTextSource,
  validateKitPrereqs,
};
