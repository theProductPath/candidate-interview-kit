const fs = require("fs");
const path = require("path");
const { discoverSources, readTextSource } = require("./source-discovery");

/* ── Helpers ────────────────────────────────────────── */

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanExtractedValue(value) {
  return String(value || "").replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").replace(/\s+/g, " ").trim();
}

function extractLabeledValue(markdown, label) {
  const pattern = new RegExp(`(?:\\*\\*)?${escapeRegex(label)}(?:\\*\\*)?\\s*:\\s*(.+)`, "i");
  const match = markdown.match(pattern);
  return match ? cleanExtractedValue(match[1]) : null;
}

function extractSection(markdown, heading) {
  const patterns = [
    new RegExp(`##\\s+${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|\\s*$)`, "i"),
    new RegExp(`${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Za-z\\s&/-]{2,}:?\\s*\\n|\\s*$)`, "i"),
  ];
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractFirstParagraph(sectionText) {
  if (!sectionText) return null;
  return sectionText.split(/\n\s*\n/).map((c) => c.replace(/\n/g, " ").trim()).find(Boolean) || null;
}

function extractBulletList(sectionText) {
  if (!sectionText) return [];
  return sectionText.split("\n").map((l) => l.trim())
    .filter((l) => l.startsWith("- ") || /^\d+\.\s+/.test(l) || /^\[[ xX]\]\s+/.test(l))
    .map((l) => l.replace(/^(- |\d+\.\s+|\[[ xX]\]\s+)/, "").trim())
    .filter(Boolean);
}

function extractTable(sectionText) {
  if (!sectionText) return [];
  const lines = sectionText.split("\n").map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (lines.length < 3) return [];
  return lines.slice(2)
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()))
    .filter((c) => c.length >= 3 && c[0] && c[0] !== "---");
}

function parseScoreValue(value) {
  const match = String(value || "").match(/([0-9.]+)/);
  return match ? Number(match[1]) : null;
}

/* ── Team File Parsing ──────────────────────────────── */

function parseTeamFile(markdown) {
  if (!markdown) return { role: null, company: null, hiringManager: null, interviewers: [] };

  const role = extractLabeledValue(markdown, "Role");
  const company = extractLabeledValue(markdown, "Company");
  const hiringManager = extractLabeledValue(markdown, "Hiring Manager");

  const INTERVIEWER_COLORS = ["#4f6ef7", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#10b981"];

  const interviewerBlocks = markdown.split(/\n##\s+/).slice(1);
  const interviewers = interviewerBlocks.map((block, idx) => {
    const firstLine = block.split("\n")[0].trim();
    const nameMatch = firstLine.match(/^(.+?)\s*[—-]\s*(.+)$/);
    const name = nameMatch ? nameMatch[1].trim() : firstLine;
    const title = nameMatch ? nameMatch[2].trim() : "";
    const isHiringManager = /\*\*Role on team:\*\*\s*Hiring Manager/i.test(block);

    const focusSection = block.match(/\*\*Focus areas:\*\*\s*\n([\s\S]*?)(?=\n##|\s*$)/i);
    const focusAreas = focusSection
      ? focusSection[1].split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- "))
        .map((l) => l.replace(/^- /, "").trim()).filter(Boolean)
      : [];

    return {
      id: slugify(name),
      name,
      title,
      isHiringManager,
      color: INTERVIEWER_COLORS[idx % INTERVIEWER_COLORS.length],
      focusAreas,
    };
  });

  return { role, company, hiringManager, interviewers };
}

/* ── Brief / Assessment Parsing ─────────────────────── */

function parseBrief(markdown) {
  if (!markdown) return null;
  const snapshotSection = extractSection(markdown, "Candidate Snapshot");
  const competencySection = extractSection(markdown, "JD Competency Assessment");
  const competencies = extractTable(competencySection).map((cells) => ({
    dim: cells[0], score: parseScoreValue(cells[1]), evidence: cells[2],
  }));
  const overallMatch = markdown.match(
    /(?:\*\*)?Overall JD Match(?::|\*\*:?)\s*(?:\*\*)?\s*([0-9.]+)\/5(?:\*\*)?\s*[—-]?\s*(.*)/i
  );
  return {
    snapshot: extractFirstParagraph(snapshotSection),
    jdCompetencies: competencies,
    jdScore: overallMatch ? Number(overallMatch[1]) : null,
    jdSummary: overallMatch && overallMatch[2] ? overallMatch[2].trim() || null : null,
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
    dim: cells[0], score: parseScoreValue(cells[1]), evidence: cells[2],
  }));
  const overallMatch = markdown.match(
    /(?:\*\*)?Overall Qualitative Score(?::|\*\*:?)\s*(?:\*\*)?\s*([0-9.]+)\/5(?:\*\*)?/i
  );

  const labels = ["Strong Yes", "Yes", "Maybe", "No"];
  const recSection = recommendationSection || "";
  const recommendation = labels.find((l) => new RegExp(`\\[x\\]\\s+${escapeRegex(l)}`, "i").test(recSection)) || "Pending";
  const rationaleMatch = recSection.match(/\*\*Rationale:\*\*\s*([\s\S]+)/);

  // Extract date from header
  const dateMatch = markdown.match(/\*.*Date:\s*([^*\n]+)/i);

  return {
    date: dateMatch ? dateMatch[1].trim() : null,
    overallImpression: extractFirstParagraph(impressionSection),
    qualDimensions: qualitative,
    qualScore: overallMatch ? Number(overallMatch[1]) : null,
    strengths: extractBulletList(strengthsSection),
    concerns: extractBulletList(concernsSection),
    notableMoments: extractBulletList(notableSection),
    recommendation,
    rationale: rationaleMatch ? rationaleMatch[1].trim() : null,
  };
}

/* ── Team Kit Data Builder ──────────────────────────── */

const CANDIDATE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

function buildTeamKitData(kitRoot) {
  const candidatesRoot = path.join(kitRoot, "candidates");
  const sources = discoverSources(kitRoot);
  const jdMarkdown = readTextSource(sources.jobDescription) || "";
  const teamMarkdown = readTextSource(sources.teamFile) || "";

  const team = parseTeamFile(teamMarkdown);

  const role = team.role || extractLabeledValue(jdMarkdown, "Role") || "Open Role";
  const company = team.company || extractLabeledValue(jdMarkdown, "Company") || "";
  const hiringManager = team.hiringManager || extractLabeledValue(jdMarkdown, "Hiring Manager") || "";

  // Extract JD competency dimensions
  const competencySection = extractSection(jdMarkdown, "Key Competencies");
  const competencyDimensions = competencySection
    ? competencySection.split("\n").map((l) => l.trim())
        .filter((l) => /^\d+\.\s+/.test(l)).map((l) => l.replace(/^\d+\.\s+/, "").trim())
    : [];

  // Standard qualitative dimensions
  const qualitativeDimensions = [
    "Multi-Platform Breadth",
    "Transformation Thinking",
    "Strategic Orientation",
    "Career Alignment",
    "Communication & Presence",
  ];

  // Discover candidates
  const candidateDirs = fs.existsSync(candidatesRoot)
    ? fs.readdirSync(candidatesRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(candidatesRoot, e.name)).sort()
    : [];

  const candidates = candidateDirs.map((candidateDir, idx) => {
    const candidateSlug = path.basename(candidateDir);
    const candidateName = candidateSlug.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");

    // Discover interviewer subfolders
    const interviewerDirs = fs.readdirSync(candidateDir, { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort();

    // Get JD scores from first available brief
    let jdScore = null;
    let jdCompetencies = [];
    let snapshot = null;

    const assessments = {};
    let briefCount = 0;
    let assessmentCount = 0;

    for (const ivSlug of interviewerDirs) {
      const briefPath = path.join(candidateDir, ivSlug, "brief.md");
      const assessmentPath = path.join(candidateDir, ivSlug, "assessment.md");

      const briefMd = readFileIfExists(briefPath);
      const assessmentMd = readFileIfExists(assessmentPath);

      if (briefMd) {
        briefCount++;
        const brief = parseBrief(briefMd);
        if (brief && jdCompetencies.length === 0) {
          jdScore = brief.jdScore;
          jdCompetencies = brief.jdCompetencies;
          snapshot = brief.snapshot;
        }
      }

      if (assessmentMd) {
        assessmentCount++;
        const assessment = parseAssessment(assessmentMd);
        if (assessment) {
          assessments[ivSlug] = {
            date: assessment.date,
            qualScore: assessment.qualScore,
            qualDimensions: assessment.qualDimensions,
            overallImpression: assessment.overallImpression,
            strengths: assessment.strengths,
            concerns: assessment.concerns,
            recommendation: assessment.recommendation,
            rationale: assessment.rationale,
          };
        }
      }
    }

    // Determine status
    let status = "not-started";
    if (assessmentCount > 0 && assessmentCount >= team.interviewers.length) {
      status = "assessed";
    } else if (assessmentCount > 0) {
      status = "partial";
    } else if (briefCount > 0) {
      status = "pending";
    }

    return {
      slug: candidateSlug,
      name: candidateName,
      status,
      color: CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length],
      jdScore,
      jdCompetencies,
      snapshot,
      assessments,
      briefCount,
      assessmentCount,
      totalInterviewers: team.interviewers.length,
    };
  });

  // Sort: assessed first (by score desc), then partial, pending, not-started
  candidates.sort((a, b) => {
    const statusOrder = { assessed: 4, partial: 3, pending: 2, "not-started": 1 };
    const sa = statusOrder[a.status] || 0;
    const sb = statusOrder[b.status] || 0;
    if (sa !== sb) return sb - sa;
    if (a.jdScore !== null && b.jdScore !== null) return b.jdScore - a.jdScore;
    return a.name.localeCompare(b.name);
  });

  const fallbackCompetencyDimensions = competencyDimensions.length > 0
    ? competencyDimensions
    : deriveCompetencyDimensionsFromCandidates(candidates);

  return {
    company,
    role,
    title: `${role} — Team Candidate Comparison`,
    hiringManager,
    generatedAt: new Date().toISOString(),
    interviewers: team.interviewers,
    competencyDimensions: fallbackCompetencyDimensions,
    qualitativeDimensions,
    candidates,
  };
}

function deriveCompetencyDimensionsFromCandidates(candidates) {
  const seen = new Set();
  const ordered = [];
  candidates.forEach((c) => {
    c.jdCompetencies.forEach((entry) => {
      const n = entry.dim.trim().toLowerCase();
      if (!n || seen.has(n)) return;
      seen.add(n);
      ordered.push(entry.dim);
    });
  });
  return ordered;
}

module.exports = { buildTeamKitData, slugify };
