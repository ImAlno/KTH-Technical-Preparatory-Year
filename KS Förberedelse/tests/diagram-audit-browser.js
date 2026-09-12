#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const zlib = require("node:zlib");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PDFTOPPM = "/opt/homebrew/bin/pdftoppm";
const FIXED_PDF_DPI = 96;
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, ".superpowers", "diagram-audit");
const PAGE_URL = pathToFileURL(path.join(__dirname, "diagram-audit-page.html")).href;
const VIEWPORT_BY_MODE = {
  desktop: [1440, 900], tablet: [768, 1024], mobile: [390, 844], print: [794, 1123]
};
const SOURCE_FILES = {
  appCss: "KS Förberedelse/assets/app.css",
  subjectConfig: "KS Förberedelse/assets/js/subject-config.js",
  units: "KS Förberedelse/assets/js/units.js",
  expressionParser: "KS Förberedelse/assets/js/expression-parser.js",
  grading: "KS Förberedelse/assets/js/grading.js",
  storage: "KS Förberedelse/assets/js/storage.js",
  timer: "KS Förberedelse/assets/js/timer.js",
  examEngine: "KS Förberedelse/assets/js/exam-engine.js",
  diagramKit: "KS Förberedelse/assets/js/diagram-kit.js",
  app: "KS Förberedelse/assets/js/app.js",
  mathSlot5: "KS Förberedelse/Matematik KS2/questions/slot-5.js",
  physicsSlot1: "KS Förberedelse/Fysik KS1/questions/slot-1.js",
  physicsSlot2: "KS Förberedelse/Fysik KS1/questions/slot-2.js",
  physicsSlot3: "KS Förberedelse/Fysik KS1/questions/slot-3.js",
  physicsSlot4: "KS Förberedelse/Fysik KS1/questions/slot-4.js",
  physicsSlot5: "KS Förberedelse/Fysik KS1/questions/slot-5.js",
  physicsQuestions: "KS Förberedelse/Fysik KS1/questions.js",
  auditPage: "KS Förberedelse/tests/diagram-audit-page.html",
  auditRunner: "KS Förberedelse/tests/diagram-audit-browser.js",
  auditVerifier: "KS Förberedelse/tests/diagram-audit-verify.js",
  auditTest: "KS Förberedelse/tests/diagram-audit.test.js",
  staticPagesTest: "KS Förberedelse/tests/static-pages.test.js",
  diagramKitTest: "KS Förberedelse/tests/diagram-kit.test.js",
  mathQuestionsTest: "KS Förberedelse/tests/math-questions.test.js",
  physicsQuestionsTest: "KS Förberedelse/tests/physics-questions.test.js"
};

class CdpConnection {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      (this.listeners.get(message.method) || []).slice().forEach((listener) => listener(message));
    });
  }

  async send(method, params, sessionId) {
    await this.ready;
    const id = this.nextId++;
    const message = { id, method, params: params || {} };
    if (sessionId) message.sessionId = sessionId;
    const response = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify(message));
    return response;
  }

  once(method, predicate) {
    return new Promise((resolve) => {
      const listener = (message) => {
        if (predicate && !predicate(message)) return;
        const current = this.listeners.get(method) || [];
        this.listeners.set(method, current.filter((candidate) => candidate !== listener));
        resolve(message);
      };
      this.listeners.set(method, (this.listeners.get(method) || []).concat(listener));
    });
  }

  on(method, listener) {
    this.listeners.set(method, (this.listeners.get(method) || []).concat(listener));
  }

  close() {
    this.socket.close();
  }
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sourceHashes() {
  return Object.fromEntries(Object.entries(SOURCE_FILES).map(([name, relativePath]) => {
    const absolutePath = path.join(PROJECT_ROOT, relativePath);
    return [name, fs.existsSync(absolutePath) ? sha256(fs.readFileSync(absolutePath)) : null];
  }));
}

function regressionsPass(value) {
  if (!value || typeof value !== "object") return false;
  const entries = Object.values(value);
  return entries.length > 0 && entries.every((entry) => entry && typeof entry === "object" ? regressionsPass(entry) : entry === "pass");
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left : aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) throw new Error("not a PNG");
  let offset = 8;
  let width; let height; let bitDepth; let colorType;
  const idat = [];
  let palette = null; let transparency = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset); const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "PLTE") palette = data;
    else if (type === "tRNS") transparency = data;
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (bitDepth !== 8 || ![0, 2, 3, 4, 6].includes(colorType)) throw new Error("unsupported PNG encoding");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * channels);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = inflated[sourceOffset++];
    const rowOffset = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const raw = inflated[sourceOffset++];
      const left = column >= channels ? pixels[rowOffset + column - channels] : 0;
      const above = row ? pixels[rowOffset - stride + column] : 0;
      const upperLeft = row && column >= channels ? pixels[rowOffset - stride + column - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : filter === 4 ? paeth(left, above, upperLeft) : NaN;
      if (!Number.isFinite(predictor)) throw new Error("unsupported PNG filter");
      pixels[rowOffset + column] = (raw + predictor) & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const source = index * channels; const target = index * 4;
    if (colorType === 0) rgba.set([pixels[source], pixels[source], pixels[source], 255], target);
    else if (colorType === 2) rgba.set([pixels[source], pixels[source + 1], pixels[source + 2], 255], target);
    else if (colorType === 3) {
      const paletteIndex = pixels[source]; const paletteOffset = paletteIndex * 3;
      rgba.set([palette[paletteOffset], palette[paletteOffset + 1], palette[paletteOffset + 2], transparency && paletteIndex < transparency.length ? transparency[paletteIndex] : 255], target);
    } else if (colorType === 4) rgba.set([pixels[source], pixels[source], pixels[source], pixels[source + 1]], target);
    else rgba.set(pixels.subarray(source, source + 4), target);
  }
  return { width, height, rgba };
}

function decodedPixelHash(buffer) {
  const decoded = decodePng(buffer);
  const dimensions = Buffer.alloc(8);
  dimensions.writeUInt32BE(decoded.width, 0); dimensions.writeUInt32BE(decoded.height, 4);
  return { width: decoded.width, height: decoded.height, hash: sha256(Buffer.concat([dimensions, decoded.rgba])) };
}

function rasterHash(pdfPath, scratchDirectory) {
  const prefix = path.join(scratchDirectory, path.basename(pdfPath, ".pdf") + "-page");
  childProcess.execFileSync(PDFTOPPM, ["-r", String(FIXED_PDF_DPI), "-png", pdfPath, prefix], { stdio: "pipe" });
  const pages = fs.readdirSync(scratchDirectory).filter((name) => name.startsWith(path.basename(prefix)) && name.endsWith(".png")).sort();
  const hash = crypto.createHash("sha256");
  pages.forEach((name) => {
    const decoded = decodePng(fs.readFileSync(path.join(scratchDirectory, name)));
    const dimensions = Buffer.alloc(8);
    dimensions.writeUInt32BE(decoded.width, 0); dimensions.writeUInt32BE(decoded.height, 4);
    hash.update(dimensions); hash.update(decoded.rgba);
  });
  pages.forEach((name) => fs.rmSync(path.join(scratchDirectory, name)));
  return { hash: hash.digest("hex"), pageCount: pages.length, dpi: FIXED_PDF_DPI };
}

async function launchChrome(options) {
  const settings = Object.assign({
    binaryPath: CHROME,
    temporaryRoot: os.tmpdir(),
    startupTimeoutMs: 15_000,
    spawnImpl: childProcess.spawn
  }, options || {});
  let profileDirectory = null;
  let browser = null;
  try {
    if (!fs.existsSync(settings.binaryPath)) throw new Error("required Chrome binary is missing: " + settings.binaryPath);
    profileDirectory = fs.mkdtempSync(path.join(settings.temporaryRoot, "ks-diagram-chrome-profile-"));
    browser = settings.spawnImpl(settings.binaryPath, [
      "--headless=new", "--disable-gpu", "--allow-file-access-from-files", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
      "--user-data-dir=" + profileDirectory, "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
      "--disable-component-update", "--disable-default-apps", "--disable-domain-reliability", "--disable-features=Translate,OptimizationHints,MediaRouter",
      "--disable-sync", "--metrics-recording-only", "--safebrowsing-disable-auto-update", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost",
      "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe"] });
    const websocketUrl = await new Promise((resolve, reject) => {
      let stderr = "";
      let settled = false;
      let timer;
      const onData = (chunk) => {
        stderr += chunk.toString();
        const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/u);
        if (match) finish(resolve, match[1]);
      };
      const onExit = (code) => finish(reject, new Error("Chrome exited before audit: " + code + "\n" + stderr));
      function finish(callback, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        browser.stderr.removeListener("data", onData);
        browser.removeListener("exit", onExit);
        callback(value);
      }
      timer = setTimeout(() => finish(reject, new Error("Chrome did not publish a debugging endpoint")), settings.startupTimeoutMs);
      browser.stderr.on("data", onData);
      browser.once("exit", onExit);
    });
    return { browser, profileDirectory, connection: new CdpConnection(websocketUrl) };
  } catch (error) {
    if (browser && !browser.killed) browser.kill("SIGTERM");
    if (profileDirectory) fs.rmSync(profileDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function evaluate(connection, sessionId, expression) {
  const response = await connection.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception && response.exceptionDetails.exception.description || response.exceptionDetails.text);
  return response.result.value;
}

async function runAudit(options) {
  const settings = Object.assign({ outputDirectory: DEFAULT_OUTPUT, screenshots: true, pdfs: true }, options || {});
  const outputDirectory = path.resolve(settings.outputDirectory);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const contactDirectory = path.join(outputDirectory, "contact-sheets");
  const printDirectory = path.join(outputDirectory, "prints");
  if (settings.screenshots) fs.mkdirSync(contactDirectory, { recursive: true });
  if (settings.pdfs) fs.mkdirSync(printDirectory, { recursive: true });
  const networkRequests = [];
  let sessionId;
  let scratchDirectory = null;
  let chrome = null;
  try {
    scratchDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ks-diagram-raster-"));
    chrome = await launchChrome();
    const connection = chrome.connection;
    const version = await connection.send("Browser.getVersion");
    const target = await connection.send("Target.createTarget", { url: "about:blank" });
    const attached = await connection.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    sessionId = attached.sessionId;
    await Promise.all([
      connection.send("Page.enable", {}, sessionId), connection.send("Runtime.enable", {}, sessionId), connection.send("Network.enable", {}, sessionId)
    ]);
    connection.on("Network.requestWillBeSent", (message) => {
      if (message.sessionId !== sessionId) return;
      const url = message.params.request.url;
      if (/^https?:/u.test(url)) networkRequests.push(url);
    });
    const loaded = connection.once("Page.loadEventFired", (message) => message.sessionId === sessionId);
    await connection.send("Page.navigate", { url: PAGE_URL }, sessionId);
    await loaded;
    const source = await evaluate(connection, sessionId, "window.DIAGRAM_AUDIT.sourceInvariants()");
    if (source.failures.length) throw new Error("source invariant failures:\n" + source.failures.join("\n"));
    const regressions = await evaluate(connection, sessionId, "window.DIAGRAM_AUDIT.regressions()");
    const preflight = await evaluate(connection, sessionId, "window.DIAGRAM_AUDIT.preflightRegression()");
    const descriptors = await evaluate(connection, sessionId, "window.DIAGRAM_AUDIT.groups()");
    const records = [];
    const contactSheets = [];
    let fonts = null;

    for (const mode of ["desktop", "tablet", "mobile", "print"]) {
      const viewport = VIEWPORT_BY_MODE[mode];
      await connection.send("Emulation.setDeviceMetricsOverride", { width: viewport[0], height: viewport[1], deviceScaleFactor: 1, mobile: false }, sessionId);
      await connection.send("Emulation.setEmulatedMedia", { media: mode === "print" ? "print" : "screen" }, sessionId);
      const applicable = descriptors.filter((descriptor) => descriptor.purpose === "prompt" || mode !== "print");
      for (const descriptor of applicable) {
        const request = { subject: descriptor.subject, slot: descriptor.slot, purpose: descriptor.purpose, mode };
        const result = await evaluate(connection, sessionId, "window.DIAGRAM_AUDIT.renderGroup(" + JSON.stringify(request) + ")");
        records.push(...result.records);
        fonts = fonts || result.fonts;
        if (settings.screenshots) {
          const layout = await connection.send("Page.getLayoutMetrics", {}, sessionId);
          const width = Math.max(viewport[0], Math.ceil(layout.cssContentSize.width));
          const height = Math.max(viewport[1], Math.ceil(layout.cssContentSize.height));
          const screenshot = await connection.send("Page.captureScreenshot", {
            format: "png", fromSurface: true, captureBeyondViewport: true,
            clip: { x: 0, y: 0, width, height, scale: 1 }
          }, sessionId);
          const name = [descriptor.purpose, descriptor.subject, "slot-" + descriptor.slot, mode].join("-") + ".png";
          const buffer = Buffer.from(screenshot.data, "base64");
          fs.writeFileSync(path.join(contactDirectory, name), buffer);
          const decoded = decodedPixelHash(buffer);
          contactSheets.push({ key: name.replace(/\.png$/u, ""), file: "contact-sheets/" + name, width: decoded.width, height: decoded.height, pixelHash: decoded.hash });
        }
      }
    }

    const printPdfs = [];
    if (settings.pdfs) {
      await connection.send("Emulation.setDeviceMetricsOverride", { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false }, sessionId);
      await connection.send("Emulation.setEmulatedMedia", { media: "print" }, sessionId);
      for (const descriptor of descriptors.filter((entry) => entry.purpose === "prompt")) {
        const request = { subject: descriptor.subject, slot: descriptor.slot, purpose: "prompt", mode: "print" };
        await evaluate(connection, sessionId, "window.DIAGRAM_AUDIT.renderGroup(" + JSON.stringify(request) + ")");
        const pdf = await connection.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false }, sessionId);
        const name = [descriptor.subject, "slot-" + descriptor.slot].join("-") + ".pdf";
        const absolutePath = path.join(printDirectory, name);
        fs.writeFileSync(absolutePath, Buffer.from(pdf.data, "base64"));
        const raster = rasterHash(absolutePath, scratchDirectory);
        printPdfs.push({ key: name.replace(/\.pdf$/u, ""), file: "prints/" + name, rasterHash: raster.hash, dpi: raster.dpi, pageCount: raster.pageCount });
      }
    }

    const environment = await evaluate(connection, sessionId, "({platform:navigator.platform,userAgent:navigator.userAgent})");
    environment.chromeProduct = version.product;
    environment.chromeRevision = version.revision;
    environment.protocolVersion = version.protocolVersion;
    environment.fonts = fonts;
    const audit = {
      schemaVersion: 1,
      pageUrl: PAGE_URL,
      chromeBinary: CHROME,
      isolatedProfile: true,
      viewportByMode: VIEWPORT_BY_MODE,
      sourceCounts: source.counts,
      records,
      regressions,
      preflight,
      networkRequests: Array.from(new Set(networkRequests)),
      contactSheets,
      printPdfs,
      fixedPdfDpi: FIXED_PDF_DPI,
      environment,
      sourceHashes: sourceHashes()
    };
    fs.writeFileSync(path.join(outputDirectory, "manifest.json"), JSON.stringify(audit, null, 2) + "\n");
    return audit;
  } finally {
    if (chrome) {
      chrome.connection.close();
      if (!chrome.browser.killed) chrome.browser.kill("SIGTERM");
      fs.rmSync(chrome.profileDirectory, { recursive: true, force: true });
    }
    if (scratchDirectory) fs.rmSync(scratchDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runAudit().then((audit) => {
    const failed = audit.records.filter((record) => record.failures.length);
    process.stdout.write(JSON.stringify({
      records: audit.records.length, passed: audit.records.length - failed.length, failed: failed.length,
      contactSheets: audit.contactSheets.length, printPdfs: audit.printPdfs.length,
      manifest: path.join(DEFAULT_OUTPUT, "manifest.json")
    }, null, 2) + "\n");
    if (failed.length || audit.networkRequests.length || !regressionsPass(audit.regressions) || audit.preflight.outcome !== "pass") process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(error.stack + "\n");
    process.exitCode = 1;
  });
}

module.exports = { runAudit, launchChrome, decodedPixelHash, rasterHash, sourceHashes, regressionsPass, VIEWPORT_BY_MODE, SOURCE_FILES };
