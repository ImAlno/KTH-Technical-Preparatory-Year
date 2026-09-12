#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runAudit } = require("./diagram-audit-browser.js");

const SUMMARY_PATH = path.join(__dirname, "fixtures", "diagram-audit-summary.json");

function recordApproval(record) {
  return { key: record.key, status: record.failures.length ? "fail" : "pass" };
}

function sheetEvidence(sheet) {
  return {
    key: sheet.key, file: sheet.file, width: sheet.width, height: sheet.height, pixelHash: sheet.pixelHash
  };
}

function pdfEvidence(pdf) {
  return {
    key: pdf.key, file: pdf.file, rasterHash: pdf.rasterHash, dpi: pdf.dpi, pageCount: pdf.pageCount
  };
}

async function verifyAudit() {
  if (!fs.existsSync(SUMMARY_PATH)) throw new Error("reviewed diagram audit summary is missing");
  const reviewed = JSON.parse(fs.readFileSync(SUMMARY_PATH, "utf8"));
  assert.equal(reviewed.schemaVersion, 1);
  assert.equal(reviewed.review.outcome, "pass");
  assert.match(reviewed.review.reviewer, /\S/u);
  assert.match(reviewed.review.date, /^\d{4}-\d{2}-\d{2}$/u);
  assert.equal(reviewed.records.length, 795);
  assert.equal(reviewed.records.filter((record) => record.status === "pass").length, 795);
  assert.equal(reviewed.contactSheets.length, 33);
  assert.equal(reviewed.contactSheets.filter((sheet) => sheet.outcome === "pass").length, 33);
  assert.equal(reviewed.printPdfs.length, 6);
  assert.equal(reviewed.printPdfs.filter((pdf) => pdf.outcome === "pass").length, 6);

  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ks-diagram-audit-verify-"));
  try {
    const current = await runAudit({ outputDirectory, screenshots: true, pdfs: true });
    assert.equal(current.records.length, 795);
    assert.equal(current.records.filter((record) => record.failures.length).length, 0);
    assert.equal(current.contactSheets.length, 33);
    assert.equal(current.printPdfs.length, 6);
    assert.deepEqual(current.sourceCounts, reviewed.counts.source);
    assert.deepEqual(current.viewportByMode, reviewed.viewportByMode);
    assert.deepEqual(current.regressions, reviewed.regressions);
    assert.deepEqual(current.preflight, reviewed.preflight);
    assert.deepEqual(current.networkRequests, []);
    assert.deepEqual(current.environment, reviewed.environment);
    assert.deepEqual(current.sourceHashes, reviewed.sourceHashes);
    assert.deepEqual(current.records.map(recordApproval), reviewed.records);
    assert.deepEqual(current.contactSheets.map(sheetEvidence), reviewed.contactSheets.map(sheetEvidence));
    assert.deepEqual(current.printPdfs.map(pdfEvidence), reviewed.printPdfs.map(pdfEvidence));
    return {
      records: current.records.length,
      contactSheets: current.contactSheets.length,
      printPdfs: current.printPdfs.length,
      outputDirectory,
      matched: true
    };
  } finally {
    fs.rmSync(outputDirectory, { recursive: true });
  }
}

if (require.main === module) {
  verifyAudit().then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }).catch((error) => {
    process.stderr.write(error.stack + "\n");
    process.exitCode = 1;
  });
}

module.exports = { verifyAudit, recordApproval, sheetEvidence, pdfEvidence };
