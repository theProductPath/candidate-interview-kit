const fs = require("fs");
const path = require("path");
const { discoverSources, readTextSource } = require("./source-discovery");

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function slugifyCandidateName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractLabeledValue(markdown, label) {
  const pattern = new RegExp(`\\*\\*${escapeRegex(label)}:\\*\\*\\s*(.+)`);
  const match = markdown.match(pattern);
  return match ? match[1].trim() : null;
}

function extractSection(markdown, heading) {
  const pattern = new RegExp(
    `##\\s+${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|\\s*$)`
  );
  const match = markdown.match(pattern);
  return match ? match[1].trim() : null;
}

function extractFirstParagraph(sectionText) {
  if (!sectionText) return null;
  return sectionText
    .split(/\n\s*\n/)
    .map((chunk) => chunk.replace(/\n/g, " ").trim())
    .find(Boolean) || null;
}

function extractBulletList(sectionText) {
  if (!sectionText) return [];
  return sectionText
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("- ") ||
        /^\d+\.\s+/.test(line) ||
        /^\[[ xX]\]\s+/.test(line)
    )
    .map((line) => line.replace(/^(- |\d+\.\s+|\[[ xX]\]\s+)/, "").trim())
    .filter(Boolean);
}

function extractTable(sectionText) {
  if (!sectionText) return [];
  const lines = sectionText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));

  if (lines.length < 3) return [];

  return lines
    .slice(2)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3 && cells[0] && cells[0] !== "---");
}

function parseRecommendation(sectionText) {
  if (!sectionText) {
    return { recommendation: "Pending", rationale: null };
  }

  const labels = ["Strong Yes", "Yes", "Maybe", "No"];
  const selected =
    labels.find((label) =>
      new RegExp(`\\[x\\]\\s+${escapeRegex(label)}`, "i").test(sectionText)
    ) || "Pending";

  const rationaleMatch = sectionText.match(/\*\*Rationale:\*\*\s*([\s\S]+)/);
  return {
    recommendation: selected,
    rationale: rationaleMatch ? rationaleMatch[1].trim() : null,
  };
}

function parseScoreValue(value) {
  const match = String(value || "").match(/([0-9.]+)/);
  return match ? Number(match[1]) : null;
}

function parseBrief(markdown) {
  if (!markdown) return null;

  const snapshotSection = extractSection(markdown, "Candidate Snapshot");
  const competencySection = extractSection(markdown, "JD Competency Assessment");
  const competencies = extractTable(competencySection).map((cells) => ({
    dim: cells[0],
    score: parseScoreValue(cells[1]),
    evidence: cells[2],
  }));

  const overallMatch = markdown.match(
    /\*\*Overall JD Match:\s*([0-9.]+)\/5\*\*\s*[—-]\s*(.+)/
  );

  return {
    snapshot: extractFirstParagraph(snapshotSection),
    jdCompetencies: competencies,
    jdScore: overallMatch ? Number(overallMatch[1]) : null,
    jdSummary: overallMatch ? overallMatch[2].trim() : null,
  };
}

function parseAssessment(markdown) {
  if (!markdown) return null;

  const impressionSection = extractSection(markdown, "Overall Impression");
  const qualitativeSection = extractSection(markdown, "Qualitative Dimension Scores");
  const strengthsSection = extractSection(markdown, "Strengths");
  const concernsSection = extractSection(markdown, "Concerns");
  const notableSection = extractSection(markdown, "Notable Moments");
  const recommendationSection = extractSection(markdown, "Recommendation");

  const qualitative = extractTable(qualitativeSection).map((cells) => ({
    dim: cells[0],
    score: parseScoreValue(cells[1]),
    evidence: cells[2],
  }));
  const overallMatch = markdown.match(/\*\*Overall Qualitative Score:\s*([0-9.]+)\/5\*\*/);
  const recommendation = parseRecommendation(recommendationSection);

  return {
    overallImpression: extractFirstParagraph(impressionSection),
    qualDimensions: qualitative,
    qualScore: overallMatch ? Number(overallMatch[1]) : null,
    strengths: extractBulletList(strengthsSection),
    concerns: extractBulletList(concernsSection),
    notableMoments: extractBulletList(notableSection),
    recommendation: recommendation.recommendation,
    rationale: recommendation.rationale,
  };
}

function buildCandidateRecord(candidateDirPath) {
  const slug = path.basename(candidateDirPath);
  const briefPath = path.join(candidateDirPath, "brief.md");
  const assessmentPath = path.join(candidateDirPath, "assessment.md");
  const brief = parseBrief(readFileIfExists(briefPath));
  const assessment = parseAssessment(readFileIfExists(assessmentPath));

  const inferredName = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const candidate = {
    slug,
    name: inferredName,
    status: "not-started",
    rec: "Not Started",
    recKey: "not-started",
    recClass: "rec-not-started",
    snapshot: null,
    jdScore: null,
    jdSummary: null,
    jdCompetencies: [],
    qualScore: null,
    qualDimensions: [],
    overallImpression: null,
    strengths: [],
    concerns: [],
    notableMoments: [],
    rationale: null,
    briefUpdatedAt: fs.existsSync(briefPath) ? fs.statSync(briefPath).mtime.toISOString() : null,
    assessmentUpdatedAt: fs.existsSync(assessmentPath)
      ? fs.statSync(assessmentPath).mtime.toISOString()
      : null,
  };

  if (brief) {
    candidate.status = "pending";
    candidate.rec = "Pending";
    candidate.recKey = "pending";
    candidate.recClass = "rec-pending";
    candidate.snapshot = brief.snapshot;
    candidate.jdScore = brief.jdScore;
    candidate.jdSummary = brief.jdSummary;
    candidate.jdCompetencies = brief.jdCompetencies;
  }

  if (assessment) {
    candidate.status = "assessed";
    candidate.rec = assessment.recommendation;
    candidate.recKey = normalizeRecommendationKey(assessment.recommendation);
    candidate.recClass = `rec-${candidate.recKey}`;
    candidate.qualScore = assessment.qualScore;
    candidate.qualDimensions = assessment.qualDimensions;
    candidate.overallImpression = assessment.overallImpression;
    candidate.strengths = assessment.strengths;
    candidate.concerns = assessment.concerns;
    candidate.notableMoments = assessment.notableMoments;
    candidate.rationale = assessment.rationale;
  }

  candidate.combined =
    candidate.jdScore !== null && candidate.qualScore !== null
      ? Number(((candidate.jdScore + candidate.qualScore) / 2).toFixed(1))
      : null;

  return candidate;
}

function buildKitData(kitRoot) {
  const candidatesRoot = path.join(kitRoot, "candidates");
  const sources = discoverSources(kitRoot);
  const jdMarkdown = readTextSource(sources.jobDescription) || "";
  const notesMarkdown = readTextSource(sources.interviewerNotes) || "";

  const role =
    extractLabeledValue(jdMarkdown, "Role") ||
    extractLabeledValue(notesMarkdown, "Role") ||
    "Open Role";
  const company = extractLabeledValue(jdMarkdown, "Company") || "";
  const hiringManager =
    extractLabeledValue(jdMarkdown, "Hiring Manager") ||
    extractLabeledValue(notesMarkdown, "Hiring Manager") ||
    "";
  const interviewer = extractLabeledValue(notesMarkdown, "Interviewer") || "";

  const competencySection = extractSection(jdMarkdown, "Key Competencies");
  const competencyDimensions = competencySection
    ? competencySection
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^\d+\.\s+/.test(line))
        .map((line) => line.replace(/^\d+\.\s+/, "").trim())
    : [];

  const candidateDirs = fs.existsSync(candidatesRoot)
    ? fs
        .readdirSync(candidatesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(candidatesRoot, entry.name))
        .sort()
    : [];

  const candidates = candidateDirs.map(buildCandidateRecord);
  candidates.sort(compareCandidates);

  const counts = {
    total: candidates.length,
    assessed: candidates.filter((candidate) => candidate.status === "assessed").length,
    pending: candidates.filter((candidate) => candidate.status === "pending").length,
    notStarted: candidates.filter((candidate) => candidate.status === "not-started").length,
  };

  return {
    company,
    role,
    title: `Candidate Comparison${role ? ` - ${role}` : ""}${company ? ` | ${company}` : ""}`,
    hiringManager,
    interviewer,
    sourceFiles: {
      jobDescription: sources.jobDescription ? path.basename(sources.jobDescription.fullPath) : null,
      interviewerNotes: sources.interviewerNotes ? path.basename(sources.interviewerNotes.fullPath) : null,
    },
    generatedAt: new Date().toISOString(),
    competencyDimensions,
    counts,
    candidates,
  };
}

function compareCandidates(left, right) {
  const leftRank = recommendationRank(left.rec);
  const rightRank = recommendationRank(right.rec);
  if (left.combined === null && right.combined === null) {
    if (leftRank !== rightRank) return rightRank - leftRank;
    return left.name.localeCompare(right.name);
  }
  if (left.combined === null) return 1;
  if (right.combined === null) return -1;
  if (right.combined !== left.combined) return right.combined - left.combined;
  return left.name.localeCompare(right.name);
}

function recommendationRank(label) {
  const order = {
    "Strong Yes": 5,
    Yes: 4,
    Maybe: 3,
    Pending: 2,
    "Not Started": 1,
    No: 0,
  };
  return order[label] ?? -1;
}

function normalizeRecommendationKey(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  buildKitData,
  slugifyCandidateName,
};
