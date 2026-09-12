#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const {
  launchChrome,
  decodedPixelHash
} = require("./diagram-audit-browser.js");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const APP_ROOT = path.join(PROJECT_ROOT, "KS Förberedelse");
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, ".superpowers", "browser-flow");
const EVIDENCE_PATH = path.join(__dirname, "browser-flow-page-results.md");
const PDFINFO = "/opt/homebrew/bin/pdfinfo";
const PDFTOPPM = "/opt/homebrew/bin/pdftoppm";
const PDFIMAGES = "/opt/homebrew/bin/pdfimages";
const FORMULA_PATH = path.join(APP_ROOT, "Kemi KS", "assets", "formelblad-ks.png");
const FORMULA_SHA256 = "e1ca7f9914fa4920e6a5f3a80281e82ad5003c8d86cfc85c487f8cf94e4dafee";
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 }
};
const PAGES = {
  hub: { relative: "index.html", title: "Hubb" },
  math: { relative: "Matematik KS2/index.html", title: "Matematik KS2", questions: 5 },
  physics: { relative: "Fysik KS1/index.html", title: "Fysik KS1", questions: 5 },
  chemistry: { relative: "Kemi KS/index.html", title: "Kemi KS", questions: 6 }
};

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function allChecksPass(value) {
  if (!value || typeof value !== "object") return value === "pass";
  const entries = Object.values(value);
  return entries.length > 0 && entries.every(allChecksPass);
}

function leafCounts(value) {
  let passed = 0;
  let failed = 0;
  function visit(entry) {
    if (entry && typeof entry === "object") Object.values(entry).forEach(visit);
    else if (entry === "pass") passed += 1;
    else failed += 1;
  }
  visit(value);
  return { passed, failed };
}

function descriptorsAreUnique(items) {
  return Array.isArray(items) && items.length > 0 && items.every((item) =>
    item && typeof item.href === "string" && item.href.length > 0 &&
    typeof item.text === "string" && item.text.length > 0 &&
    Number.isInteger(item.index) && item.index >= 0
  ) && new Set(items.map((item) => `${item.href}\n${item.text}\n${item.index}`)).size === items.length;
}

function requiredInventoryPresent(actual, required) {
  const entries = Object.entries(required || {});
  return Boolean(actual) && entries.length > 0 && entries.every(([role, minimum]) =>
    Number.isFinite(actual[role]) && actual[role] >= minimum
  );
}

function isA4PageBox(box) {
  const expected = { width: 595.276, height: 841.89 };
  const tolerance = 0.75;
  return [box && box.media, box && box.crop].every((candidate) => candidate &&
    Math.abs(candidate.width - expected.width) <= tolerance &&
    Math.abs(candidate.height - expected.height) <= tolerance
  );
}

function ensureGroup(root, names) {
  let cursor = root;
  names.forEach((name) => {
    cursor[name] = cursor[name] || {};
    cursor = cursor[name];
  });
  return cursor;
}

function recorder(checks, details) {
  return function record(pathParts, condition, detail) {
    const names = pathParts.slice();
    const leaf = names.pop();
    const group = ensureGroup(checks, names);
    if (Object.hasOwn(group, leaf)) throw new Error("duplicate browser-flow check: " + pathParts.join("."));
    group[leaf] = condition ? "pass" : "fail";
    details.push({ check: pathParts.join("."), outcome: condition ? "pass" : "fail", detail: String(detail || "") });
    return condition;
  };
}

async function evaluate(connection, sessionId, expression) {
  const response = await connection.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  }, sessionId);
  if (response.exceptionDetails) {
    const exception = response.exceptionDetails.exception;
    throw new Error(exception && exception.description || response.exceptionDetails.text || "page evaluation failed");
  }
  return response.result.value;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(connection, sessionId, expression, timeoutMs) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < (timeoutMs || 10_000)) {
    last = await evaluate(connection, sessionId, expression);
    if (last) return last;
    await delay(25);
  }
  throw new Error("timed out waiting for page state: " + expression + " (last=" + JSON.stringify(last) + ")");
}

async function navigate(connection, sessionId, url) {
  const loaded = connection.once("Page.loadEventFired", (message) => message.sessionId === sessionId);
  await connection.send("Page.navigate", { url }, sessionId);
  await loaded;
  await waitFor(connection, sessionId, "document.readyState === 'complete'");
}

async function reload(connection, sessionId) {
  const loaded = connection.once("Page.loadEventFired", (message) => message.sessionId === sessionId);
  await connection.send("Page.reload", { ignoreCache: true }, sessionId);
  await loaded;
  await waitFor(connection, sessionId, "document.readyState === 'complete'");
}

async function setViewport(connection, sessionId, viewport) {
  await connection.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false
  }, sessionId);
  await connection.send("Emulation.setEmulatedMedia", { media: "screen" }, sessionId);
}

async function key(connection, sessionId, name, options) {
  const settings = options || {};
  const keys = {
    Tab: { code: "Tab", windowsVirtualKeyCode: 9 },
    Enter: { code: "Enter", windowsVirtualKeyCode: 13 },
    Escape: { code: "Escape", windowsVirtualKeyCode: 27 },
    ArrowLeft: { code: "ArrowLeft", windowsVirtualKeyCode: 37 },
    ArrowUp: { code: "ArrowUp", windowsVirtualKeyCode: 38 },
    ArrowRight: { code: "ArrowRight", windowsVirtualKeyCode: 39 },
    ArrowDown: { code: "ArrowDown", windowsVirtualKeyCode: 40 }
  };
  const descriptor = keys[name];
  if (!descriptor) throw new Error("unsupported key: " + name);
  const modifiers = settings.shift ? 8 : 0;
  await connection.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: name, code: descriptor.code,
    windowsVirtualKeyCode: descriptor.windowsVirtualKeyCode,
    nativeVirtualKeyCode: descriptor.windowsVirtualKeyCode, modifiers
  }, sessionId);
  await connection.send("Input.dispatchKeyEvent", {
    type: "keyUp", key: name, code: descriptor.code,
    windowsVirtualKeyCode: descriptor.windowsVirtualKeyCode,
    nativeVirtualKeyCode: descriptor.windowsVirtualKeyCode, modifiers
  }, sessionId);
}

async function clickSelector(connection, sessionId, selector) {
  return evaluate(connection, sessionId, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
}

async function clickButtonText(connection, sessionId, text) {
  return evaluate(connection, sessionId, `(() => {
    const element = Array.from(document.querySelectorAll("button")).find((button) =>
      !button.hidden && button.textContent.trim() === ${JSON.stringify(text)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
}

const DOM_AUDIT_EXPRESSION = `(() => {
  function visible(element) {
    if (element.closest("details:not([open])") && element.tagName !== "SUMMARY") return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return !element.hidden && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }
  const selector = "a[href],button,input,select,textarea,summary,[tabindex]";
  const allControls = Array.from(document.querySelectorAll(selector));
  const modal = document.querySelector("dialog[open]");
  function descriptor(element) {
    const text = (element.getAttribute("aria-label") || element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60);
    const href = element instanceof HTMLAnchorElement ? element.href : "";
    const name = element.getAttribute("name") || "";
    const value = element.getAttribute("value") || "";
    return element.tagName.toLowerCase() + (element.id ? "#" + element.id : "") +
      (href ? '[href="' + href + '"]' : "") + (name ? '[name="' + name + '"]' : "") +
      (value ? '[value="' + value + '"]' : "") + "@" + allControls.indexOf(element) + (text ? ":" + text : "");
  }
  function tabbables() {
    const candidates = allControls.filter((element) => visible(element) && !element.disabled &&
      !element.closest("[inert]") && element.tabIndex >= 0 && (!modal || modal.contains(element)));
    return candidates.filter((element, index) => {
      if (!(element instanceof HTMLInputElement) || element.type !== "radio" || !element.name) return true;
      const group = candidates.filter((item) => item instanceof HTMLInputElement && item.type === "radio" && item.name === element.name);
      const checked = group.find((item) => item.checked);
      return checked ? element === checked : element === group[0];
    }).sort((left, right) => {
      const lp = left.tabIndex > 0 ? left.tabIndex : Number.MAX_SAFE_INTEGER;
      const rp = right.tabIndex > 0 ? right.tabIndex : Number.MAX_SAFE_INTEGER;
      if (lp !== rp) return lp - rp;
      return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }
  const tabStops = tabbables();
  const mobileTargets = allControls
    .filter((element) => visible(element) && !element.closest("[inert]") && (!modal || modal.contains(element)))
    .map((element) => {
      let target = element;
      let exception = "";
      if (element instanceof HTMLInputElement && ["radio", "checkbox"].includes(element.type)) {
        const label = element.closest("label") || (element.id && document.querySelector('label[for="' + CSS.escape(element.id) + '"]'));
        if (label && visible(label)) {
          target = label;
          exception = "native input uses its associated label hit area";
        }
      }
      const rect = target.getBoundingClientRect();
      return { control: descriptor(element), width: rect.width, height: rect.height, exception };
    });
  return {
    overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    mobileTargets,
    targetFailures: mobileTargets.filter((item) => item.width < 43.99 || item.height < 43.99),
    radioCases: mobileTargets.filter((item) => item.control.startsWith("input") && item.exception).length,
    tabOrder: tabStops.map(descriptor),
    activeDescriptor: document.activeElement && allControls.includes(document.activeElement) ? descriptor(document.activeElement) : "",
    inventory: {
      link: tabStops.filter((element) => element.matches("a[href]")).length,
      questionNav: tabStops.filter((element) => element.matches(".question-nav button")).length,
      answer: tabStops.filter((element) => element.matches(".answer-area input,.answer-area select,.answer-area textarea")).length,
      primary: tabStops.filter((element) => element.matches(".primary-button")).length,
      timer: tabStops.filter((element) => element.matches(".timer button")).length,
      formulaTrigger: tabStops.filter((element) => element.matches("#formula-open")).length
    },
    hubLinks: Array.from(document.querySelectorAll(".subject-start")).filter(visible).map((link, index) => ({
      href: link.href, text: link.textContent.trim().replace(/\\s+/g, " "), index
    })),
    headings: Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(visible).map((heading) => ({ level: Number(heading.tagName.slice(1)), text: heading.textContent.trim() }))
  };
})()`;

const FOCUS_AUDIT_EXPRESSION = `(() => {
  function parseColor(value) {
    const match = String(value).match(/[\\d.]+/g);
    if (!match || match.length < 3) return null;
    return { r: +match[0], g: +match[1], b: +match[2], a: match[3] === undefined ? 1 : +match[3] };
  }
  function over(foreground, background) {
    if (!foreground) return background;
    const alpha = foreground.a + background.a * (1 - foreground.a);
    return { r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
      g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
      b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha, a: alpha };
  }
  function background(element) {
    let result = { r: 255, g: 255, b: 255, a: 1 };
    const layers = [];
    for (let current = element; current; current = current.parentElement) layers.push(parseColor(getComputedStyle(current).backgroundColor));
    layers.reverse().filter(Boolean).forEach((layer) => { result = over(layer, result); });
    return result;
  }
  function luminance(color) {
    const channel = (value) => { const normalized = value / 255; return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4); };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }
  function ratio(first, second) { const values = [luminance(first), luminance(second)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05); }
  function visible(element) {
    if (element.closest("details:not([open])") && element.tagName !== "SUMMARY") return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return !element.hidden && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }
  function descriptor(element) {
    const all = Array.from(document.querySelectorAll("a[href],button,input,select,textarea,summary,[tabindex]"));
    return element.tagName.toLowerCase() + (element.id ? "#" + element.id : "") + "@" + all.indexOf(element) + ":" + (element.getAttribute("aria-label") || element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 50);
  }
  function shadowExtent(value) {
    if (!value || value === "none") return { left: 0, top: 0, right: 0, bottom: 0, colors: [] };
    const shadows = []; let current = ""; let depth = 0;
    for (const character of value) { if (character === "(") depth += 1; if (character === ")") depth -= 1; if (character === "," && depth === 0) { shadows.push(current); current = ""; } else current += character; }
    if (current) shadows.push(current);
    const result = { left: 0, top: 0, right: 0, bottom: 0, colors: [] };
    shadows.filter((shadow) => !/\\binset\\b/.test(shadow)).forEach((shadow) => {
      const numbers = Array.from(shadow.matchAll(/(-?\\d*\\.?\\d+)px/g), (match) => +match[1]);
      const x = numbers[0] || 0, y = numbers[1] || 0, blur = numbers[2] || 0, spread = numbers[3] || 0;
      result.left = Math.max(result.left, Math.max(0, -x + blur + spread));
      result.right = Math.max(result.right, Math.max(0, x + blur + spread));
      result.top = Math.max(result.top, Math.max(0, -y + blur + spread));
      result.bottom = Math.max(result.bottom, Math.max(0, y + blur + spread));
      const colors = shadow.match(/rgba?\\([^)]*\\)|#[0-9a-f]{3,8}/ig); if (colors) result.colors.push(...colors);
    });
    return result;
  }
  const modal = document.querySelector("dialog[open]");
  const controls = Array.from(document.querySelectorAll("a[href],button,input,select,textarea,summary,[tabindex]"))
    .filter((element) => visible(element) && !element.disabled && !element.closest("[inert]") && element.tabIndex >= 0 && (!modal || modal.contains(element)));
  const failures = [];
  const paints = [];
  controls.forEach((element) => {
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    element.focus({ preventScroll: true });
    const rect = element.getBoundingClientRect();
    const focusStyle = getComputedStyle(element);
    const outlineWidth = focusStyle.outlineStyle === "none" ? 0 : parseFloat(focusStyle.outlineWidth) || 0;
    const outlineOffset = parseFloat(focusStyle.outlineOffset) || 0;
    const outlineExtent = Math.max(0, outlineWidth + outlineOffset);
    const shadow = shadowExtent(focusStyle.boxShadow);
    const expansion = { left: Math.max(outlineExtent, shadow.left), top: Math.max(outlineExtent, shadow.top), right: Math.max(outlineExtent, shadow.right), bottom: Math.max(outlineExtent, shadow.bottom) };
    const painted = { left: rect.left - expansion.left, top: rect.top - expansion.top, right: rect.right + expansion.right, bottom: rect.bottom + expansion.bottom };
    let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX + " " + style.overflowY)) {
        const clip = ancestor.getBoundingClientRect();
        left = Math.max(left, clip.left); top = Math.max(top, clip.top);
        right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom);
      }
    }
    const adjacent = background(element.parentElement || element);
    const outlineColor = over(parseColor(focusStyle.outlineColor), adjacent);
    const outlineRatio = outlineWidth > 0 ? ratio(outlineColor, adjacent) : 0;
    const shadowRatios = shadow.colors.map((color) => ratio(over(parseColor(color), adjacent), adjacent));
    const indicatorContrast = outlineWidth > 0 ? outlineRatio : (shadowRatios.length ? Math.min(...shadowRatios) : 0);
    const clipped = painted.left < left - 1 || painted.top < top - 1 || painted.right > right + 1 || painted.bottom > bottom + 1;
    const indicator = outlineWidth > 0 || shadow.left > 0 || shadow.top > 0 || shadow.right > 0 || shadow.bottom > 0;
    const paint = { control: descriptor(element), outlineWidth, outlineOffset, boxShadow: focusStyle.boxShadow, expansion, painted, clip: { left, top, right, bottom }, indicatorContrast, focusVisible: element.matches(":focus-visible") };
    paints.push(paint);
    if (clipped || !indicator || indicatorContrast + 0.001 < 3 || !paint.focusVisible) failures.push(Object.assign({ clipped, indicator }, paint));
  });
  return { controls: controls.length, paints, failures };
})()`;

const CONTRAST_AUDIT_EXPRESSION = `(() => {
  function parse(value) {
    const match = String(value).match(/[\\d.]+/g);
    if (!match || match.length < 3) return null;
    return { r: +match[0], g: +match[1], b: +match[2], a: match[3] === undefined ? 1 : +match[3] };
  }
  function over(foreground, background) {
    const alpha = foreground.a + background.a * (1 - foreground.a);
    if (!alpha) return { r: 255, g: 255, b: 255, a: 1 };
    return {
      r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
      g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
      b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
      a: alpha
    };
  }
  function background(element) {
    let result = { r: 255, g: 255, b: 255, a: 1 };
    const layers = [];
    for (let current = element; current; current = current.parentElement) layers.push(parse(getComputedStyle(current).backgroundColor));
    layers.reverse().filter(Boolean).forEach((layer) => { result = over(layer, result); });
    return result;
  }
  function luminance(color) {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }
  function ratio(first, second) {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }
  function visible(element) {
    if (element.closest("details:not([open])") && element.tagName !== "SUMMARY") return false;
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return !element.hidden && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }
  function descriptor(element) {
    const all = Array.from(document.querySelectorAll("*"));
    return element.tagName.toLowerCase() + (element.id ? "#" + element.id : "") +
      (element.classList.length ? "." + Array.from(element.classList).join(".") : "") + "@" + all.indexOf(element);
  }
  const selectors = {
    body: "body", muted: ".subject-structure, #session-state, .field-help, .grade-summary span, .grade-message, .interpreted-answer, .exam-total span, dialog p, .formula-controls output",
    link: "a[href]", primary: ".primary-button:not(:disabled)", secondary: ".neutral-button:not(:disabled), .text-button:not(:disabled), .timer button:not(:disabled)",
    answer_control: ".answer-area input:not(:disabled), .answer-area select:not(:disabled), .answer-area textarea:not(:disabled)",
    disabled: "button:disabled", current_nav: ".question-nav button[aria-current=step]:not([data-flagged=true])",
    current_flagged_nav: ".question-nav button[aria-current=step][data-flagged=true]", flagged_nav: ".question-nav button[data-flagged=true]:not([aria-current=step])",
    work: ".work-on-paper", comparison: ".comparison", solution: ".solution", grade_warning: ".grade[data-tone=warning]", grade_success: ".grade[data-tone=success]",
    result: ".exam-total", status_warning: ".status-region[data-tone=warning]", status_success: ".status-region[data-tone=success]",
    radio: ".choice-option input[type=radio]", formula_control: ".formula-controls button:not(:disabled)", override_control: ".override-grade summary, .point-choices button"
  };
  const boundarySides = {
    primary: ["Top", "Right", "Bottom", "Left"], secondary: ["Top", "Right", "Bottom", "Left"], answer_control: ["Top", "Right", "Bottom", "Left"], disabled: ["Top", "Right", "Bottom", "Left"],
    current_nav: ["Top", "Right", "Bottom", "Left"], current_flagged_nav: ["Top", "Right", "Bottom", "Left"], flagged_nav: ["Top", "Right", "Bottom", "Left"],
    work: ["Left"], comparison: ["Top"], solution: ["Top"], grade_warning: ["Left"], grade_success: ["Left"], result: ["Top", "Right", "Bottom", "Left"],
    status_warning: ["Top", "Right", "Bottom", "Left"], status_success: ["Top", "Right", "Bottom", "Left"], formula_control: ["Top", "Right", "Bottom", "Left"],
    override_control: ["Top", "Right", "Bottom", "Left"]
  };
  const samples = [];
  const inventory = {};
  Object.entries(selectors).forEach(([role, selector]) => {
    const elements = Array.from(document.querySelectorAll(selector)).filter(visible);
    inventory[role] = elements.length;
    elements.forEach((element) => {
      const style = getComputedStyle(element);
      const bg = background(element);
      const color = over(parse(style.color), bg);
      const fontSize = parseFloat(style.fontSize);
      const weight = parseInt(style.fontWeight, 10) || 400;
      const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
      const measured = ratio(color, bg);
      samples.push({ role, control: descriptor(element), kind: "text", ratio: measured, required: large ? 3 : 4.5, pass: measured + 0.001 >= (large ? 3 : 4.5) });
      (boundarySides[role] || []).forEach((side) => {
        const width = parseFloat(style["border" + side + "Width"]);
        if (!(width > 0)) return;
        const adjacent = background(element.parentElement || element);
        const border = over(parse(style["border" + side + "Color"]), adjacent);
        const borderRatio = ratio(border, adjacent);
        samples.push({ role: role + "_boundary_" + side.toLowerCase(), control: descriptor(element), kind: "ui", ratio: borderRatio, required: 3, pass: borderRatio + 0.001 >= 3 });
      });
      if (role === "radio") {
        const adjacent = background(element.parentElement || element);
        const outline = over(parse(style.outlineColor), adjacent);
        const outlineRatio = ratio(outline, adjacent);
        samples.push({ role: "radio_graphic", control: descriptor(element), kind: "ui", ratio: outlineRatio, required: 3, pass: parseFloat(style.outlineWidth) > 0 && outlineRatio + 0.001 >= 3 });
      }
    });
  });
  return { inventory, samples, failures: samples.filter((sample) => !sample.pass) };
})()`;

function pageUrl(page) {
  return pathToFileURL(path.join(APP_ROOT, page.relative)).href;
}

async function installDeterminism(connection, sessionId) {
  await connection.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "Math.random = function () { return 0.3141592653589793; };"
  }, sessionId);
}

async function ensureExamReady(connection, sessionId, expectedCount) {
  const recoveryOpen = await evaluate(connection, sessionId, "Boolean(document.querySelector('#recovery-dialog[open]'))");
  if (recoveryOpen) {
    await clickSelector(connection, sessionId, "#recovery-continue");
    await waitFor(connection, sessionId, `!document.querySelector("#recovery-dialog").open && document.querySelectorAll("#question-list button").length === ${expectedCount}`);
  } else {
    await waitFor(connection, sessionId, `document.querySelectorAll("#question-list button").length === ${expectedCount}`);
  }
}

async function freshExam(connection, sessionId, page) {
  await navigate(connection, sessionId, pageUrl(page));
  await evaluate(connection, sessionId, "localStorage.clear(); true");
  await reload(connection, sessionId);
  await ensureExamReady(connection, sessionId, page.questions);
}

async function activeSnapshot(connection, sessionId) {
  return evaluate(connection, sessionId, `(() => {
    const id = (window.KS_SUBJECT_DATA.subject || window.KS_SUBJECT_DATA.config).id;
    const key = "ks-practice:v1:" + id + ":active";
    return { id, key, historyKey: "ks-practice:v1:" + id + ":history", raw: localStorage.getItem(key), snapshot: JSON.parse(localStorage.getItem(key)) };
  })()`);
}

async function browserTabRoundTrip(connection, sessionId, section, record, requirements, keyboardResults) {
  const audit = await evaluate(connection, sessionId, DOM_AUDIT_EXPRESSION);
  if (audit.tabOrder.length < 3) {
    record([section, "tab_forward_complete"], false, "fewer than three tab stops");
    record([section, "tab_reverse_complete"], false, "fewer than three tab stops");
    record([section, "tab_inventory"], false, JSON.stringify(audit.inventory));
    return;
  }
  const start = audit.tabOrder[0];
  await evaluate(connection, sessionId, `(() => {
    const selector = "a[href],button,input,select,textarea,summary,[tabindex]";
    const candidates = Array.from(document.querySelectorAll(selector));
    const descriptor = (element) => { const text = (element.getAttribute("aria-label") || element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60); const href = element instanceof HTMLAnchorElement ? element.href : ""; const name = element.getAttribute("name") || ""; const value = element.getAttribute("value") || ""; return element.tagName.toLowerCase() + (element.id ? "#" + element.id : "") + (href ? '[href="' + href + '"]' : "") + (name ? '[name="' + name + '"]' : "") + (value ? '[value="' + value + '"]' : "") + "@" + candidates.indexOf(element) + (text ? ":" + text : ""); };
    const target = candidates.find((element) => descriptor(element) === ${JSON.stringify(start)});
    if (target) target.focus();
    return Boolean(target);
  })()`);
  const forward = [start];
  for (let index = 1; index < audit.tabOrder.length; index += 1) {
    await key(connection, sessionId, "Tab");
    forward.push((await evaluate(connection, sessionId, DOM_AUDIT_EXPRESSION)).activeDescriptor);
  }
  const reverse = [forward[forward.length - 1]];
  for (let index = 1; index < audit.tabOrder.length; index += 1) {
    await key(connection, sessionId, "Tab", { shift: true });
    reverse.push((await evaluate(connection, sessionId, DOM_AUDIT_EXPRESSION)).activeDescriptor);
  }
  const expectedReverse = audit.tabOrder.slice().reverse();
  record([section, "tab_forward_complete"], JSON.stringify(forward) === JSON.stringify(audit.tabOrder), JSON.stringify({ expected: audit.tabOrder, actual: forward }));
  record([section, "tab_reverse_complete"], JSON.stringify(reverse) === JSON.stringify(expectedReverse), JSON.stringify({ expected: expectedReverse, actual: reverse }));
  record([section, "tab_inventory"], requiredInventoryPresent(audit.inventory, requirements), JSON.stringify({ required: requirements, actual: audit.inventory }));
  keyboardResults.push({ section, inventory: audit.inventory, forward, reverse });
}

async function auditPageViewport(connection, sessionId, pageKey, viewportKey, record, layoutResults, keyboardResults) {
  const page = PAGES[pageKey];
  await setViewport(connection, sessionId, VIEWPORTS[viewportKey]);
  await navigate(connection, sessionId, pageUrl(page));
  if (page.questions) await ensureExamReady(connection, sessionId, page.questions);
  const audit = await evaluate(connection, sessionId, DOM_AUDIT_EXPRESSION);
  const section = `layout_${pageKey}_${viewportKey}`;
  record([section, "no_overflow"], audit.overflow, `${audit.scrollWidth} <= ${audit.clientWidth}`);
  if (viewportKey === "mobile") {
    record([section, "touch_targets"], audit.targetFailures.length === 0, JSON.stringify(audit.targetFailures));
  } else {
    record([section, "touch_targets"], true, "44px minimum is a mobile requirement");
  }
  const focusAudit = await evaluate(connection, sessionId, FOCUS_AUDIT_EXPRESSION);
  record([section, "focus_not_clipped"], focusAudit.controls > 0 && focusAudit.paints.length === focusAudit.controls && focusAudit.failures.length === 0, JSON.stringify(focusAudit.failures));
  if (viewportKey === "desktop") {
    const requirements = pageKey === "hub"
      ? { link: 3 }
      : Object.assign({ link: 1, questionNav: page.questions, answer: 1, primary: 1, timer: 2 }, pageKey === "chemistry" ? { formulaTrigger: 1 } : {});
    await browserTabRoundTrip(connection, sessionId, section, record, requirements, keyboardResults);
  }
  const contrast = await evaluate(connection, sessionId, CONTRAST_AUDIT_EXPRESSION);
  const requiredContrast = pageKey === "hub"
    ? { body: 1, muted: 3, link: 3 }
    : { body: 1, muted: 1, link: 1, primary: 1, secondary: 1, disabled: 1, answer_control: 1, current_nav: 1, work: 1 };
  record([section, "contrast"], requiredInventoryPresent(contrast.inventory, requiredContrast) && contrast.failures.length === 0, JSON.stringify(contrast));
  layoutResults.push({ page: page.title, viewport: viewportKey, size: VIEWPORTS[viewportKey], audit, focus: focusAudit, contrast });
}

async function auditHub(connection, sessionId, viewportKey, record) {
  await setViewport(connection, sessionId, VIEWPORTS[viewportKey]);
  const url = pageUrl(PAGES.hub);
  await navigate(connection, sessionId, url);
  const audit = await evaluate(connection, sessionId, DOM_AUDIT_EXPRESSION);
  const section = `hub_${viewportKey}`;
  record([section, "three_links"], (await evaluate(connection, sessionId, "document.querySelectorAll('.subject-start').length")) === 3, "three subject links");
  record([section, "unique_link_descriptors"], descriptorsAreUnique(audit.hubLinks) && audit.hubLinks.length === 3, JSON.stringify(audit.hubLinks));
  record([section, "heading_order"], audit.headings.length === 4 && audit.headings[0].level === 1 && audit.headings.slice(1).every((item) => item.level === 2), JSON.stringify(audit.headings));
  record([section, "no_overflow"], audit.overflow, `${audit.scrollWidth} <= ${audit.clientWidth}`);
  const hrefs = audit.hubLinks;
  let activated = 0;
  for (const descriptor of hrefs) {
    await navigate(connection, sessionId, url);
    await evaluate(connection, sessionId, `(() => { const links = Array.from(document.querySelectorAll('.subject-start')); const link = links[${descriptor.index}]; if (!link || link.href !== ${JSON.stringify(descriptor.href)} || link.textContent.trim().replace(/\\s+/g, " ") !== ${JSON.stringify(descriptor.text)}) return false; link.focus(); return true; })()`);
    await key(connection, sessionId, "Enter");
    await waitFor(connection, sessionId, `location.href === ${JSON.stringify(descriptor.href)} && document.readyState === 'complete'`);
    const current = await evaluate(connection, sessionId, "location.href");
    if (current === descriptor.href) activated += 1;
  }
  record([section, "keyboard_activation"], activated === 3, `${activated}/3 links activated by Enter`);
}

async function fillCurrentFirstField(connection, sessionId, value) {
  return evaluate(connection, sessionId, `(() => {
    const radio = document.querySelector('.answer-area input[type=radio]');
    if (radio) { radio.click(); return { kind: "choice", value: radio.value }; }
    const input = document.querySelector('.answer-area input');
    if (!input) return null;
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { kind: "text", value: input.value };
  })()`);
}

async function runSubjectFlow(connection, sessionId, pageKey, record, flowResults) {
  const page = PAGES[pageKey];
  const section = `flow_${pageKey}`;
  await setViewport(connection, sessionId, VIEWPORTS.desktop);
  await freshExam(connection, sessionId, page);
  const initial = await activeSnapshot(connection, sessionId);
  record([section, "fresh_exam"], initial.snapshot.status === "active" && initial.snapshot.questionIds.length === page.questions, initial.snapshot.examId);

  let navigationPass = true;
  for (let position = 0; position < page.questions; position += 1) {
    const state = await evaluate(connection, sessionId, `(() => {
      document.querySelectorAll('#question-list button')[${position}].click();
      const inputs = Array.from(document.querySelectorAll('.answer-area input'));
      return { current: document.querySelector('#question-list button[aria-current=step] .question-number').textContent, blank: inputs.every((input) => input.type === 'radio' ? !input.checked : input.value === '') };
    })()`);
    navigationPass = navigationPass && state.current === String(position + 1) && state.blank;
  }
  record([section, "free_blank_navigation"], navigationPass, `visited 1..${page.questions} without answers`);

  const order = Array.from(new Set([page.questions - 1, 0, Math.floor(page.questions / 2)]));
  const answers = [];
  for (const position of order) {
    await evaluate(connection, sessionId, `document.querySelectorAll('#question-list button')[${position}].click()`);
    answers.push({ position, answer: await fillCurrentFirstField(connection, sessionId, String(position + 1)) });
  }
  if (pageKey === "chemistry") {
    const choicePosition = await evaluate(connection, sessionId, `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(initial.key)}));
      return saved.questionIds.findIndex((id) => Object.values(window.KS_SUBJECT_DATA.slots).flat().find((q) => q.id === id).fields.some((field) => field.kind === 'choice'));
    })()`);
    if (choicePosition >= 0) {
      await evaluate(connection, sessionId, `document.querySelectorAll('#question-list button')[${choicePosition}].click()`);
      answers.push({ position: choicePosition, answer: await fillCurrentFirstField(connection, sessionId, "choice") });
    }
  }
  const beforeReload = await activeSnapshot(connection, sessionId);
  const answeredPositions = Object.keys(beforeReload.snapshot.answers).length;
  record([section, "nonsequential_answers"], answeredPositions >= 3, JSON.stringify(answers));
  record([section, "real_chemistry_choice"], pageKey !== "chemistry" || answers.some((entry) => entry.answer && entry.answer.kind === "choice"), JSON.stringify(answers));

  await reload(connection, sessionId);
  const recoveryOpen = await evaluate(connection, sessionId, "document.querySelector('#recovery-dialog').open");
  await clickSelector(connection, sessionId, "#recovery-continue");
  await waitFor(connection, sessionId, "!document.querySelector('#recovery-dialog').open");
  const afterReload = await activeSnapshot(connection, sessionId);
  record([section, "reload_continue"], recoveryOpen && JSON.stringify(afterReload.snapshot.answers) === JSON.stringify(beforeReload.snapshot.answers), "compatible answers persisted");

  await clickSelector(connection, sessionId, "#timer-start");
  const started = await activeSnapshot(connection, sessionId);
  await clickSelector(connection, sessionId, "#timer-pause");
  const paused = await activeSnapshot(connection, sessionId);
  await clickSelector(connection, sessionId, "#timer-reset");
  const reset = await activeSnapshot(connection, sessionId);
  record([section, "timer"], started.snapshot.timer.runningSince !== null && paused.snapshot.timer.runningSince === null && reset.snapshot.timer.elapsedMs === 0 && reset.snapshot.timer.runningSince === null, JSON.stringify({ started: started.snapshot.timer, paused: paused.snapshot.timer, reset: reset.snapshot.timer }));

  await clickButtonText(connection, sessionId, "Rätta provet");
  const submitWarning = await evaluate(connection, sessionId, `(() => ({ open: document.querySelector('#submit-dialog').open, text: document.querySelector('#submit-message').textContent }))()`);
  record([section, "blank_warning"], submitWarning.open && /obesvarad/.test(submitWarning.text), submitWarning.text);
  await clickSelector(connection, sessionId, "#submit-confirm");
  await waitFor(connection, sessionId, "document.querySelector('.grade') !== null");
  const graded = await activeSnapshot(connection, sessionId);
  const locked = await evaluate(connection, sessionId, `(() => ({ inputs: document.querySelectorAll('.answer-area input').length, solution: Boolean(document.querySelector('.solution')), comparison: Boolean(document.querySelector('.comparison')), button: Array.from(document.querySelectorAll('button')).some((button) => button.textContent.trim() === 'Visa lösning') }))()`);
  record([section, "submit_lock"], graded.snapshot.status === "graded" && locked.inputs === 0, JSON.stringify(locked));
  record([section, "solution_gate"], !locked.solution && !locked.comparison && locked.button, JSON.stringify(locked));

  const warningContrast = await evaluate(connection, sessionId, CONTRAST_AUDIT_EXPRESSION);
  record([section, "warning_contrast"], warningContrast.failures.length === 0 && warningContrast.samples.some((sample) => sample.role === "grade_warning"), JSON.stringify(warningContrast));
  await clickButtonText(connection, sessionId, "Visa lösning");
  const reveal = await evaluate(connection, sessionId, `(() => {
    const comparison = document.querySelector('.comparison');
    return { solution: Boolean(document.querySelector('.solution')), comparison: Boolean(comparison), interactive: comparison ? comparison.querySelectorAll('input,button,select,textarea,[contenteditable=true]').length : -1 };
  })()`);
  record([section, "solution_reveal"], reveal.solution && reveal.comparison && reveal.interactive === 0, JSON.stringify(reveal));

  await clickSelector(connection, sessionId, ".override-grade summary");
  const focusKey = await evaluate(connection, sessionId, `(() => {
    const buttons = Array.from(document.querySelectorAll('.override-grade [data-focus-key]'));
    const button = buttons[buttons.length - 1];
    const key = button.dataset.focusKey;
    button.click();
    return key;
  })()`);
  const override = await evaluate(connection, sessionId, `(() => ({ focusKey: document.activeElement && document.activeElement.dataset.focusKey || '', open: Boolean(document.querySelector('.override-grade[open]')), tone: document.querySelector('.grade').dataset.tone }))()`);
  record([section, "override_focus"], override.focusKey === focusKey && override.open, JSON.stringify({ focusKey, override }));
  const successContrast = await evaluate(connection, sessionId, CONTRAST_AUDIT_EXPRESSION);
  record([section, "success_contrast"], successContrast.failures.length === 0 && successContrast.samples.some((sample) => sample.role === "grade_success"), JSON.stringify(successContrast));

  const boundary = await activeSnapshot(connection, sessionId);
  await evaluate(connection, sessionId, `(() => {
    const active = JSON.parse(localStorage.getItem(${JSON.stringify(boundary.key)}));
    const history = JSON.parse(localStorage.getItem(${JSON.stringify(boundary.historyKey)}));
    active.questionIds.forEach((id, index) => { history.slots[String(index + 1)] = { queue: [], lastId: id }; });
    localStorage.setItem(${JSON.stringify(boundary.historyKey)}, JSON.stringify(history));
    return true;
  })()`);
  await reload(connection, sessionId);
  await clickSelector(connection, sessionId, "#recovery-new");
  const firstConfirmation = await evaluate(connection, sessionId, "document.querySelector('#recovery-dialog').dataset.confirming === 'true'");
  await clickSelector(connection, sessionId, "#recovery-new");
  await waitFor(connection, sessionId, "!document.querySelector('#recovery-dialog').open");
  const replacement = await activeSnapshot(connection, sessionId);
  const noRepeats = replacement.snapshot.questionIds.every((id, index) => id !== boundary.snapshot.questionIds[index]);
  record([section, "shuffle_boundary"], firstConfirmation && noRepeats, JSON.stringify({ before: boundary.snapshot.questionIds, after: replacement.snapshot.questionIds }));

  flowResults.push({ subject: page.title, questions: page.questions, answeredPositions, checks: 13, examBefore: initial.snapshot.questionIds, examAfterBoundary: replacement.snapshot.questionIds });
}

async function runRecoveryFlows(connection, sessionId, record) {
  const page = PAGES.math;
  await setViewport(connection, sessionId, VIEWPORTS.desktop);
  const variants = [
    { name: "version1", mutate: `(snapshot) => { snapshot.schemaVersion = 1; }` },
    { name: "changed_schema", mutate: `(snapshot) => { snapshot.fieldSchema[snapshot.questionIds[0]][0].kind = 'choice'; }` }
  ];
  for (const variant of variants) {
    await freshExam(connection, sessionId, page);
    const original = await activeSnapshot(connection, sessionId);
    const seeded = await evaluate(connection, sessionId, `(() => {
      const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(original.key)}));
      (${variant.mutate})(snapshot);
      const sentinel = { schemaVersion: 1, slots: {} };
      const expected = { schemaVersion: 1, slots: {} };
      const expectedQuestionIds = [];
      Object.keys(window.KS_SUBJECT_DATA.slots).sort((left, right) => Number(left) - Number(right)).forEach((slot) => {
        const bank = window.KS_SUBJECT_DATA.slots[slot];
        const first = bank[1].id, second = bank[2].id, previous = bank[0].id;
        sentinel.slots[slot] = { queue: [first, second], lastId: previous };
        expected.slots[slot] = { queue: [second], lastId: first };
        expectedQuestionIds.push(first);
      });
      const activeRaw = JSON.stringify(snapshot), historyRaw = JSON.stringify(sentinel), expectedHistoryRaw = JSON.stringify(expected);
      localStorage.setItem(${JSON.stringify(original.key)}, activeRaw);
      localStorage.setItem(${JSON.stringify(original.historyKey)}, historyRaw);
      return { activeRaw, historyRaw, expectedHistoryRaw, expectedQuestionIds };
    })()`);
    await reload(connection, sessionId);
    const state = await evaluate(connection, sessionId, `(() => ({ open: document.querySelector('#recovery-dialog').open, text: document.querySelector('#recovery-message').textContent, active: localStorage.getItem(${JSON.stringify(original.key)}), history: localStorage.getItem(${JSON.stringify(original.historyKey)}) }))()`);
    record(["recovery", variant.name + "_message"], state.open && /svarstyp har uppdaterats/.test(state.text), state.text);
    record(["recovery", variant.name + "_read_only"], state.active === seeded.activeRaw && state.history === seeded.historyRaw, JSON.stringify({ expected: seeded, actual: state }));
    await clickSelector(connection, sessionId, "#recovery-new");
    const once = await evaluate(connection, sessionId, `(() => ({ confirming: document.querySelector('#recovery-dialog').dataset.confirming, active: localStorage.getItem(${JSON.stringify(original.key)}), history: localStorage.getItem(${JSON.stringify(original.historyKey)}) }))()`);
    record(["recovery", variant.name + "_first_choice_read_only"], once.confirming === "true" && once.active === seeded.activeRaw && once.history === seeded.historyRaw, JSON.stringify(once));
    await clickSelector(connection, sessionId, "#recovery-new");
    await waitFor(connection, sessionId, "!document.querySelector('#recovery-dialog').open");
    const after = await activeSnapshot(connection, sessionId);
    const historyRaw = await evaluate(connection, sessionId, `localStorage.getItem(${JSON.stringify(original.historyKey)})`);
    record(["recovery", variant.name + "_explicit_replace"], after.snapshot.schemaVersion === 2 && after.raw !== seeded.activeRaw && JSON.stringify(after.snapshot.questionIds) === JSON.stringify(seeded.expectedQuestionIds), JSON.stringify(after.snapshot.questionIds));
    record(["recovery", variant.name + "_history_after_replace"], historyRaw === seeded.expectedHistoryRaw, JSON.stringify({ expected: seeded.expectedHistoryRaw, actual: historyRaw }));
  }
}

async function auditMobileState(connection, sessionId, section, expectedContrast, record, stateResults) {
  const dom = await evaluate(connection, sessionId, DOM_AUDIT_EXPRESSION);
  const focus = await evaluate(connection, sessionId, FOCUS_AUDIT_EXPRESSION);
  const contrast = await evaluate(connection, sessionId, CONTRAST_AUDIT_EXPRESSION);
  record([section, "no_overflow"], dom.overflow, `${dom.scrollWidth} <= ${dom.clientWidth}`);
  record([section, "touch_targets"], dom.mobileTargets.length > 0 && dom.targetFailures.length === 0, JSON.stringify(dom.targetFailures));
  record([section, "focus_paint"], focus.controls > 0 && focus.paints.length === focus.controls && focus.failures.length === 0, JSON.stringify(focus.failures));
  record([section, "contrast_inventory"], requiredInventoryPresent(contrast.inventory, expectedContrast), JSON.stringify({ required: expectedContrast, actual: contrast.inventory }));
  record([section, "contrast_all_instances"], contrast.samples.length > 0 && contrast.failures.length === 0, JSON.stringify(contrast.failures));
  stateResults.push({ section, dom, focus, contrast, expectedContrast });
}

async function runMobileStateFlows(connection, sessionId, record, stateResults) {
  await setViewport(connection, sessionId, VIEWPORTS.mobile);
  for (const pageKey of ["math", "physics", "chemistry"]) {
    const page = PAGES[pageKey];
    await freshExam(connection, sessionId, page);
    const base = { body: 1, muted: 1, link: 1, primary: 1, secondary: 1, disabled: 1, answer_control: 1, current_nav: 1, work: 1 };
    await auditMobileState(connection, sessionId, `state_${pageKey}_active`, base, record, stateResults);

    if (pageKey === "math") {
      const active = await activeSnapshot(connection, sessionId);
      await evaluate(connection, sessionId, `(() => { const snapshot = JSON.parse(localStorage.getItem(${JSON.stringify(active.key)})); snapshot.timer.elapsedMs = snapshot.timer.durationMs - 1; snapshot.timer.runningSince = Date.now() - 1000; localStorage.setItem(${JSON.stringify(active.key)}, JSON.stringify(snapshot)); return true; })()`);
      await reload(connection, sessionId);
      await clickSelector(connection, sessionId, "#recovery-continue");
      await waitFor(connection, sessionId, "document.querySelector('#status-region').dataset.tone === 'warning'");
      await auditMobileState(connection, sessionId, "state_math_timer_warning", Object.assign({}, base, { status_warning: 1 }), record, stateResults);
      await freshExam(connection, sessionId, page);
    }

    await clickSelector(connection, sessionId, ".flag-button");
    const flaggedBase = Object.assign({}, base, { current_flagged_nav: 1 });
    delete flaggedBase.current_nav;
    await auditMobileState(connection, sessionId, `state_${pageKey}_active_flagged`, flaggedBase, record, stateResults);
    await evaluate(connection, sessionId, "document.querySelectorAll('#question-list button')[1].click(); true");
    await auditMobileState(connection, sessionId, `state_${pageKey}_flagged_other`, Object.assign({}, base, { flagged_nav: 1 }), record, stateResults);
    await evaluate(connection, sessionId, "document.querySelectorAll('#question-list button')[0].click(); true");
    await clickSelector(connection, sessionId, ".flag-button");

    if (pageKey === "chemistry") {
      const choice = await evaluate(connection, sessionId, `(() => {
        const subject = window.KS_SUBJECT_DATA.subject || window.KS_SUBJECT_DATA.config;
        const active = JSON.parse(localStorage.getItem("ks-practice:v1:" + subject.id + ":active"));
        const bank = Object.values(window.KS_SUBJECT_DATA.slots).flat();
        const position = active.questionIds.findIndex((id) => bank.find((question) => question.id === id).fields.some((field) => field.kind === "choice"));
        if (position >= 0) document.querySelectorAll("#question-list button")[position].click();
        return { position, radios: document.querySelectorAll('.answer-area input[type="radio"]').length };
      })()`);
      record(["state_chemistry_choice", "radio_nonzero"], choice.position >= 0 && choice.radios > 0, JSON.stringify(choice));
      await auditMobileState(connection, sessionId, "state_chemistry_choice", Object.assign({}, base, { radio: 1 }), record, stateResults);

      await clickSelector(connection, sessionId, "#formula-open");
      await auditMobileState(connection, sessionId, "state_chemistry_formula_open", { body: 1, muted: 1, primary: 1, secondary: 4, formula_control: 4 }, record, stateResults);
      await clickSelector(connection, sessionId, "#formula-dialog [data-dialog-close]");
    }

    const workQuestion = await evaluate(connection, sessionId, `(() => {
      const subject = window.KS_SUBJECT_DATA.subject || window.KS_SUBJECT_DATA.config;
      const active = JSON.parse(localStorage.getItem("ks-practice:v1:" + subject.id + ":active"));
      const bank = Object.values(window.KS_SUBJECT_DATA.slots).flat();
      let position = active.questionIds.findIndex((id) => { const question = bank.find((item) => item.id === id); return question.workOnPaper && question.fields.some((field) => field.kind !== "choice"); });
      if (position < 0) position = active.questionIds.findIndex((id) => bank.find((item) => item.id === id).workOnPaper);
      document.querySelectorAll("#question-list button")[position].click();
      const input = document.querySelector('.answer-area input:not([type="radio"])');
      if (input) { input.value = "999999999"; input.dispatchEvent(new Event("input", { bubbles: true })); }
      return { position, hasInput: Boolean(input), work: Boolean(document.querySelector(".work-on-paper")) };
    })()`);
    record([`state_${pageKey}_graded`, "work_question_selected"], workQuestion.position >= 0 && workQuestion.work, JSON.stringify(workQuestion));
    await clickButtonText(connection, sessionId, "Rätta provet");
    await clickSelector(connection, sessionId, "#submit-confirm");
    await waitFor(connection, sessionId, "document.querySelector('.grade') !== null");
    await auditMobileState(connection, sessionId, `state_${pageKey}_graded`, { body: 1, muted: 1, link: 1, secondary: 1, disabled: 3, current_nav: 1, work: 1, grade_warning: 1, result: 1, status_success: 1, override_control: 1 }, record, stateResults);

    await clickButtonText(connection, sessionId, "Visa lösning");
    await auditMobileState(connection, sessionId, `state_${pageKey}_solution`, { body: 1, muted: 1, link: 1, secondary: 1, disabled: 3, current_nav: 1, work: 1, grade_warning: 1, result: 1, solution: 1, comparison: 1, override_control: 1 }, record, stateResults);
    await clickSelector(connection, sessionId, ".override-grade summary");
    await auditMobileState(connection, sessionId, `state_${pageKey}_override_open`, { body: 1, muted: 1, link: 1, secondary: 2, disabled: 3, current_nav: 1, work: 1, grade_warning: 1, result: 1, solution: 1, comparison: 1, override_control: 2 }, record, stateResults);
    await evaluate(connection, sessionId, `(() => { const buttons = document.querySelectorAll('.point-choices button'); buttons[buttons.length - 1].click(); return buttons.length; })()`);
    await auditMobileState(connection, sessionId, `state_${pageKey}_override_success`, { body: 1, muted: 1, link: 1, secondary: 2, disabled: 3, current_nav: 1, work: 1, grade_success: 1, result: 1, solution: 1, comparison: 1, status_success: 1, override_control: 2 }, record, stateResults);
  }
}

async function formulaDialogFlow(connection, sessionId, record, formulaSequences) {
  const trace = (label) => { if (process.env.KS_BROWSER_FLOW_PROGRESS === "1") process.stderr.write(`[browser-flow] formula ${label}\n`); };
  const page = PAGES.chemistry;
  trace("navigate");
  await setViewport(connection, sessionId, VIEWPORTS.desktop);
  await navigate(connection, sessionId, pageUrl(page));
  await ensureExamReady(connection, sessionId, page.questions);
  trace("ready");
  const section = "formula";
  const source = await evaluate(connection, sessionId, `(() => {
    const image = document.querySelector('#formula-image');
    return { src: image.getAttribute('src'), currentSrc: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight, complete: image.complete };
  })()`);
  record([section, "exact_source"], source.src === "assets/formelblad-ks.png" && source.currentSrc.startsWith("file:") && source.complete && source.width === 2481 && source.height === 3508, JSON.stringify(source));

  await clickSelector(connection, sessionId, "#formula-open");
  trace("opened");
  let dialog = await evaluate(connection, sessionId, `(() => ({ open: document.querySelector('#formula-dialog').open, focus: document.activeElement.id }))()`);
  record([section, "open_initial_focus"], dialog.open && dialog.focus === "formula-content", JSON.stringify(dialog));
  const expectedTabs = ["formula-content", "formula-zoom-out", "formula-zoom-in", "formula-fit", "print-formula", "Stäng", "formula-content"];
  const expectedReverse = ["formula-content", "Stäng", "print-formula", "formula-fit", "formula-zoom-in", "formula-zoom-out", "formula-content"];
  const actualTabs = ["formula-content"];
  for (let index = 1; index < expectedTabs.length; index += 1) {
    await key(connection, sessionId, "Tab");
    actualTabs.push(await evaluate(connection, sessionId, "document.activeElement.id || document.activeElement.textContent.trim()"));
  }
  record([section, "desktop_tab_order"], JSON.stringify(actualTabs.slice(0, 5)) === JSON.stringify(expectedTabs.slice(0, 5)), JSON.stringify(actualTabs));
  record([section, "desktop_tab_cycle"], JSON.stringify(actualTabs) === JSON.stringify(expectedTabs), JSON.stringify(actualTabs));
  const desktopReverse = [actualTabs[actualTabs.length - 1]];
  for (let index = 1; index < expectedReverse.length; index += 1) {
    await key(connection, sessionId, "Tab", { shift: true });
    desktopReverse.push(await evaluate(connection, sessionId, "document.activeElement.id || document.activeElement.textContent.trim()"));
  }
  record([section, "desktop_shift_tab"], JSON.stringify(desktopReverse) === JSON.stringify(expectedReverse), JSON.stringify(desktopReverse));
  formulaSequences.push({ viewport: "desktop", forward: actualTabs, reverse: desktopReverse });
  await key(connection, sessionId, "Escape");
  trace("escaped");
  await waitFor(connection, sessionId, "document.activeElement && document.activeElement.id === 'formula-open'");
  dialog = await evaluate(connection, sessionId, `(() => ({ open: document.querySelector('#formula-dialog').open, focus: document.activeElement.id }))()`);
  record([section, "escape_focus_return"], !dialog.open && dialog.focus === "formula-open", JSON.stringify(dialog));

  await clickSelector(connection, sessionId, "#formula-open");
  trace("zoom");
  for (let count = 0; count < 4; count += 1) await clickSelector(connection, sessionId, "#formula-zoom-out");
  const minimum = await evaluate(connection, sessionId, `(() => ({ text: document.querySelector('#formula-zoom-output').textContent.trim(), disabled: document.querySelector('#formula-zoom-out').disabled }))()`);
  for (let count = 0; count < 12; count += 1) await clickSelector(connection, sessionId, "#formula-zoom-in");
  const maximum = await evaluate(connection, sessionId, `(() => ({ text: document.querySelector('#formula-zoom-output').textContent.trim(), disabled: document.querySelector('#formula-zoom-in').disabled }))()`);
  record([section, "zoom_limits"], minimum.text === "50 %" && minimum.disabled && maximum.text === "300 %" && maximum.disabled, JSON.stringify({ minimum, maximum }));

  const box = await evaluate(connection, sessionId, `(() => { const rect = document.querySelector('#formula-content').getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
  trace("wheel before " + JSON.stringify(box));
  await connection.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, button: "none" }, sessionId);
  const wheelDispatch = connection.send("Input.dispatchMouseEvent", {
    type: "mouseWheel", x: box.x, y: box.y, deltaX: 0, deltaY: 240, pointerType: "mouse"
  }, sessionId);
  await Promise.race([wheelDispatch, delay(250)]);
  trace("wheel sent");
  await delay(50);
  const wheel = await evaluate(connection, sessionId, `(() => ({ left: document.querySelector('#formula-content').scrollLeft, top: document.querySelector('#formula-content').scrollTop }))()`);
  trace("wheel read " + JSON.stringify(wheel));
  await evaluate(connection, sessionId, "document.querySelector('#formula-content').focus()");
  trace("arrow right before");
  await key(connection, sessionId, "ArrowRight");
  trace("arrow down before");
  await key(connection, sessionId, "ArrowDown");
  const arrows = await evaluate(connection, sessionId, `(() => ({ left: document.querySelector('#formula-content').scrollLeft, top: document.querySelector('#formula-content').scrollTop }))()`);
  trace("panned");
  record([section, "wheel_pan"], wheel.top > 0, JSON.stringify(wheel));
  record([section, "arrow_pan"], arrows.left > wheel.left && arrows.top > wheel.top, JSON.stringify({ wheel, arrows }));
  await clickSelector(connection, sessionId, "#formula-fit");
  const fit = await evaluate(connection, sessionId, `(() => ({ zoom: document.querySelector('#formula-zoom-output').textContent.trim(), left: document.querySelector('#formula-content').scrollLeft, top: document.querySelector('#formula-content').scrollTop }))()`);
  record([section, "fit"], fit.zoom === "100 %" && fit.left === 0 && fit.top === 0, JSON.stringify(fit));

  const printAction = await evaluate(connection, sessionId, `(() => {
    window.__formulaPrint = null;
    window.print = () => { window.__formulaPrint = document.body.dataset.printMode || null; };
    document.querySelector('#print-formula').click();
    return window.__formulaPrint;
  })()`);
  trace("print action");
  record([section, "separate_print_action"], printAction === "formula", String(printAction));
  await evaluate(connection, sessionId, "document.body.removeAttribute('data-print-mode'); document.querySelector('#formula-dialog').close(); true");

  await setViewport(connection, sessionId, VIEWPORTS.mobile);
  trace("mobile");
  await clickSelector(connection, sessionId, "#formula-open");
  const mobileTabs = [await evaluate(connection, sessionId, "document.activeElement.id || document.activeElement.textContent.trim()")];
  for (let index = 1; index < expectedTabs.length; index += 1) {
    await key(connection, sessionId, "Tab");
    mobileTabs.push(await evaluate(connection, sessionId, "document.activeElement.id || document.activeElement.textContent.trim()"));
  }
  record([section, "mobile_tab_order"], JSON.stringify(mobileTabs.slice(0, 5)) === JSON.stringify(expectedTabs.slice(0, 5)), JSON.stringify(mobileTabs));
  record([section, "mobile_tab_cycle"], JSON.stringify(mobileTabs) === JSON.stringify(expectedTabs), JSON.stringify(mobileTabs));
  const mobileReverse = [mobileTabs[mobileTabs.length - 1]];
  for (let index = 1; index < expectedReverse.length; index += 1) {
    await key(connection, sessionId, "Tab", { shift: true });
    mobileReverse.push(await evaluate(connection, sessionId, "document.activeElement.id || document.activeElement.textContent.trim()"));
  }
  record([section, "mobile_shift_tab"], JSON.stringify(mobileReverse) === JSON.stringify(expectedReverse), JSON.stringify(mobileReverse));
  formulaSequences.push({ viewport: "mobile", forward: mobileTabs, reverse: mobileReverse });
  await clickSelector(connection, sessionId, "#formula-dialog [data-dialog-close]");
  await waitFor(connection, sessionId, "document.activeElement && document.activeElement.id === 'formula-open'");
  const closeFocus = await evaluate(connection, sessionId, `(() => ({ open: document.querySelector('#formula-dialog').open, focus: document.activeElement.id }))()`);
  record([section, "close_focus_return"], !closeFocus.open && closeFocus.focus === "formula-open", JSON.stringify(closeFocus));
  trace("done");
  return source;
}

function pdfInspection(filePath) {
  let output = childProcess.execFileSync(PDFINFO, ["-box", filePath], { encoding: "utf8" });
  const countMatch = output.match(/^Pages:\s+(\d+)/mu);
  if (!countMatch) throw new Error("pdfinfo did not report a page count for " + filePath);
  const pages = Number(countMatch[1]);
  output = childProcess.execFileSync(PDFINFO, ["-f", "1", "-l", String(pages), "-box", filePath], { encoding: "utf8" });
  const boxes = Array.from({ length: pages }, (_, index) => {
    const page = index + 1;
    function box(name) {
      const match = output.match(new RegExp("^Page\\s+" + page + "\\s+" + name + ":\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)", "mu"));
      if (!match) return null;
      return { width: Number(match[3]) - Number(match[1]), height: Number(match[4]) - Number(match[2]) };
    }
    return { page, media: box("MediaBox"), crop: box("CropBox") };
  });
  return { pages, boxes };
}

function rasterFirstPage(pdfPath, screenshotPath) {
  const prefix = screenshotPath.replace(/\.png$/u, "");
  childProcess.execFileSync(PDFTOPPM, ["-f", "1", "-singlefile", "-r", "96", "-png", pdfPath, prefix], { stdio: "pipe" });
  return decodedPixelHash(fs.readFileSync(screenshotPath));
}

function formulaEmbeddedImage(pdfPath, scratchDirectory) {
  const prefix = path.join(scratchDirectory, "formula-image");
  childProcess.execFileSync(PDFIMAGES, ["-png", pdfPath, prefix], { stdio: "pipe" });
  const files = fs.readdirSync(scratchDirectory).filter((name) => name.startsWith("formula-image-") && name.endsWith(".png"));
  const images = files.map((name) => {
    const absolute = path.join(scratchDirectory, name);
    return { name, ...decodedPixelHash(fs.readFileSync(absolute)) };
  }).sort((left, right) => right.width * right.height - left.width * left.height);
  return images[0] || null;
}

async function printFlows(connection, sessionId, outputDirectory, record, printResults) {
  const printDirectory = path.join(outputDirectory, "prints");
  const screenshotDirectory = path.join(outputDirectory, "screenshots");
  fs.mkdirSync(printDirectory, { recursive: true });
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  await connection.send("Emulation.setDeviceMetricsOverride", { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false }, sessionId);

  for (const pageKey of ["math", "physics", "chemistry"]) {
    const page = PAGES[pageKey];
    await connection.send("Emulation.setEmulatedMedia", { media: "screen" }, sessionId);
    await freshExam(connection, sessionId, page);
    await clickButtonText(connection, sessionId, "Rätta provet");
    await clickSelector(connection, sessionId, "#submit-confirm");
    await waitFor(connection, sessionId, "document.querySelector('.grade') !== null");
    await clickButtonText(connection, sessionId, "Visa lösning");
    await clickSelector(connection, sessionId, ".override-grade summary");
    const selectors = [".app-header", ".question-nav", ".status-region", ".timer", ".screen-controls", ".answer-area", ".grade", ".solution-controls", ".solution", ".comparison", ".override-grade", ".point-choices", ".saved-answer", ".field-results"];
    const beforePrint = await evaluate(connection, sessionId, `(() => Object.fromEntries(${JSON.stringify([".app-header", ".question-nav", ".status-region", ".timer", ".screen-controls", ".answer-area", ".grade", ".solution-controls", ".solution", ".comparison", ".override-grade", ".point-choices", ".saved-answer", ".field-results"])}.map((selector) => [selector, document.querySelectorAll(selector).length])))()`);
    record(["print", pageKey + "_screen_inventory"], requiredInventoryPresent(beforePrint, Object.fromEntries(selectors.map((selector) => [selector, 1]))), JSON.stringify(beforePrint));
    await connection.send("Emulation.setEmulatedMedia", { media: "print" }, sessionId);
    const state = await evaluate(connection, sessionId, `(() => {
      const selectors = ${JSON.stringify([".app-header", ".question-nav", ".status-region", ".timer", ".screen-controls", ".answer-area", ".grade", ".solution-controls", ".solution", ".comparison", ".override-grade", ".point-choices", ".saved-answer", ".field-results"])};
      const effectivelyHidden = (element) => { for (let current = element; current; current = current.parentElement) { const style = getComputedStyle(current); if (style.display === "none" || style.visibility === "hidden") return true; } return false; };
      const hiddenInventory = Object.fromEntries(selectors.map((selector) => { const elements = Array.from(document.querySelectorAll(selector)); return [selector, { count: elements.length, hidden: elements.filter(effectivelyHidden).length }]; }));
      const hidden = Object.values(hiddenInventory).every((entry) => entry.count > 0 && entry.hidden === entry.count);
      const questions = Array.from(document.querySelectorAll('.print-question'));
      const diagrams = Array.from(document.querySelectorAll('.print-exam svg')).map((svg) => { const rect = svg.getBoundingClientRect(); return { width: rect.width, height: rect.height, text: svg.querySelectorAll('text').length }; });
      const spaces = Array.from(document.querySelectorAll('.print-answer-space')).map((space) => space.getBoundingClientRect().height);
      return { hidden, hiddenInventory, printDisplay: getComputedStyle(document.querySelector('.print-exam')).display, questions: questions.length, diagrams, spaces };
    })()`);
    const visibleDiagrams = state.diagrams.every((diagram) => diagram.width >= 120 && diagram.height >= 80);
    record(["print", pageKey + "_visibility"], state.hidden && state.printDisplay !== "none" && state.questions === page.questions, JSON.stringify(state));
    record(["print", pageKey + "_work_space"], state.spaces.length === page.questions && state.spaces.every((height) => height >= 110), JSON.stringify(state.spaces));
    record(["print", pageKey + "_diagrams"], visibleDiagrams, JSON.stringify(state.diagrams));
    const pdf = await connection.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false }, sessionId);
    const pdfPath = path.join(printDirectory, pageKey + "-exam.pdf");
    fs.writeFileSync(pdfPath, Buffer.from(pdf.data, "base64"));
    const inspection = pdfInspection(pdfPath);
    const pages = inspection.pages;
    const a4Pages = inspection.boxes.filter(isA4PageBox).length;
    const screenshotPath = path.join(screenshotDirectory, pageKey + "-exam-page-1.png");
    const raster = rasterFirstPage(pdfPath, screenshotPath);
    const rasterA4 = Math.abs(raster.width / raster.height - 210 / 297) <= 0.002;
    record(["print", pageKey + "_pdf"], pages === page.questions && a4Pages === pages && raster.width > 0 && raster.height > 0 && rasterA4, JSON.stringify({ pages, a4Pages, boxes: inspection.boxes, raster, rasterA4 }));
    printResults.push({ name: page.title, file: path.relative(outputDirectory, pdfPath), pages, a4Pages, pageBoxes: inspection.boxes, firstPageRaster: raster, screenInventory: beforePrint, hiddenInventory: state.hiddenInventory });
  }

  const page = PAGES.chemistry;
  await connection.send("Emulation.setEmulatedMedia", { media: "screen" }, sessionId);
  await freshExam(connection, sessionId, page);
  const nonFormulaBefore = await evaluate(connection, sessionId, "Array.from(document.body.children).filter((element) => element.id !== 'formula-dialog').length");
  record(["print", "formula_nonformula_inventory"], nonFormulaBefore > 0, String(nonFormulaBefore));
  await connection.send("Emulation.setEmulatedMedia", { media: "print" }, sessionId);
  await evaluate(connection, sessionId, "document.body.dataset.printMode = 'formula'; true");
  const formulaState = await evaluate(connection, sessionId, `(() => {
    const effectivelyHidden = (element) => { for (let current = element; current; current = current.parentElement) { const style = getComputedStyle(current); if (style.display === "none" || style.visibility === "hidden") return true; } return false; };
    const image = document.querySelector('#formula-image');
    const rect = image.getBoundingClientRect();
    const nonFormula = Array.from(document.body.children).filter((element) => element.id !== "formula-dialog");
    return { src: image.getAttribute('src'), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, width: rect.width, height: rect.height,
      dialog: getComputedStyle(document.querySelector('#formula-dialog')).display, toolbar: getComputedStyle(document.querySelector('.formula-toolbar')).display,
      nonFormulaCount: nonFormula.length, nonFormulaHidden: nonFormula.filter(effectivelyHidden).length,
      contentVisible: !effectivelyHidden(document.querySelector("#formula-content")), imageVisible: !effectivelyHidden(image) };
  })()`);
  const pdf = await connection.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false }, sessionId);
  const pdfPath = path.join(printDirectory, "chemistry-formula-sheet.pdf");
  fs.writeFileSync(pdfPath, Buffer.from(pdf.data, "base64"));
  const inspection = pdfInspection(pdfPath);
  const pages = inspection.pages;
  const a4Pages = inspection.boxes.filter(isA4PageBox).length;
  const screenshotPath = path.join(screenshotDirectory, "chemistry-formula-sheet-page-1.png");
  const raster = rasterFirstPage(pdfPath, screenshotPath);
  const embedded = formulaEmbeddedImage(pdfPath, outputDirectory);
  const sourcePixels = decodedPixelHash(fs.readFileSync(FORMULA_PATH));
  record(["print", "formula_visibility"], formulaState.nonFormulaCount > 0 && formulaState.nonFormulaHidden === formulaState.nonFormulaCount && formulaState.dialog !== "none" && formulaState.toolbar === "none" && formulaState.contentVisible && formulaState.imageVisible && formulaState.src === "assets/formelblad-ks.png" && formulaState.naturalWidth === 2481 && formulaState.naturalHeight === 3508, JSON.stringify(formulaState));
  record(["print", "formula_one_page"], pages === 1 && a4Pages === 1 && Math.abs(raster.width / raster.height - 210 / 297) <= 0.002, JSON.stringify({ pages, a4Pages, boxes: inspection.boxes, raster }));
  record(["print", "formula_source_pixels"], Boolean(embedded) && embedded.hash === sourcePixels.hash && embedded.width === sourcePixels.width && embedded.height === sourcePixels.height, JSON.stringify({ embedded, sourcePixels }));
  printResults.push({ name: "Kemins formelblad", file: path.relative(outputDirectory, pdfPath), pages, a4Pages, pageBoxes: inspection.boxes, firstPageRaster: raster, embeddedImage: embedded, nonFormulaCount: formulaState.nonFormulaCount });
  await evaluate(connection, sessionId, "document.body.removeAttribute('data-print-mode'); true");
}

function evidenceMarkdown(result) {
  const lines = [
    "# Real Chrome file-flow evidence",
    "",
    `- Date: ${result.date}`,
    `- Chrome: ${result.chrome.product}`,
    `- Revision: ${result.chrome.revision}`,
    `- Protocol: ${result.chrome.protocolVersion}`,
    `- Harness: \`node \"KS Förberedelse/tests/browser-flow-browser.js\"\``,
    `- Isolated temporary profile: yes (removed in \`finally\`)`,
    `- External network requests: ${result.summary.externalRequests}`,
    `- Console/application errors: ${result.summary.consoleErrors}`,
    "",
    "## Local URLs",
    ""
  ];
  Object.values(result.urls).forEach((url) => lines.push(`- \`${url}\``));
  lines.push("", "## Viewport matrix", "", "| Page | Viewport | Size | Overflow | Mobile target failures | Clipped focus targets | Contrast failures |", "|---|---:|---:|---:|---:|---:|---:|");
  result.layouts.forEach((entry) => lines.push(`| ${entry.page} | ${entry.viewport} | ${entry.size.width}×${entry.size.height} | ${entry.audit.overflow ? 0 : 1} | ${entry.audit.targetFailures.length} | ${entry.focus.failures.length} | ${entry.contrast.failures.length} |`));
  lines.push("", "Native radio/checkbox controls are measured through their associated visible label hit area. Disabled controls remain in touch-size and contrast inventories; only disabled, inert, closed-disclosure and modal-background controls are excluded from keyboard/focus traversal.");
  lines.push("", "## Complete keyboard traversal", "");
  result.keyboardResults.forEach((entry) => {
    lines.push(`### ${entry.section}`, "", `- Inventory: \`${JSON.stringify(entry.inventory)}\``, `- Forward (${entry.forward.length}): \`${JSON.stringify(entry.forward)}\``, `- Reverse (${entry.reverse.length}): \`${JSON.stringify(entry.reverse)}\``, "");
  });
  lines.push("### Formula dialog wrap", "");
  result.formulaSequences.forEach((entry) => {
    lines.push(`- ${entry.viewport} forward (${entry.forward.length}): \`${JSON.stringify(entry.forward)}\``, `- ${entry.viewport} reverse (${entry.reverse.length}): \`${JSON.stringify(entry.reverse)}\``);
  });
  lines.push("", "## Mobile runtime-state matrix", "", "| State | Radio cases | Touch targets | Touch failures | Focus paints | Focus failures | Contrast samples | Contrast failures |", "|---|---:|---:|---:|---:|---:|---:|---:|");
  result.states.forEach((entry) => lines.push(`| ${entry.section} | ${entry.dom.radioCases} | ${entry.dom.mobileTargets.length} | ${entry.dom.targetFailures.length} | ${entry.focus.paints.length} | ${entry.focus.failures.length} | ${entry.contrast.samples.length} | ${entry.contrast.failures.length} |`));
  lines.push("", "Each runtime row also enforced its state-specific nonzero role inventory. Inventories include active text fields, chemistry radios, current/flagged navigation, formula controls, warning/success grades, result, revealed solution/comparison, override disclosure and manual score controls. Focus paint uses computed outline width plus offset and outer box-shadow extents against viewport and clipping ancestors; every visible focus indicator is tested at 3:1.");
  const contrastRoles = {};
  result.states.forEach((entry) => Object.entries(entry.contrast.inventory).forEach(([role, count]) => { contrastRoles[role] = (contrastRoles[role] || 0) + count; }));
  lines.push("", `Runtime contrast inventory totals: \`${JSON.stringify(contrastRoles)}\`. Every visible instance was tested; normal text uses 4.5:1, large text and each required UI boundary side/graphic use 3:1.`);
  lines.push("", "## Functional flows", "", "| Subject | Questions | Non-sequential answered positions | Boundary repeat failures | Result |", "|---|---:|---:|---:|---:|");
  result.flows.forEach((flow) => {
    const repeats = flow.examAfterBoundary.filter((id, index) => id === flow.examBefore[index]).length;
    lines.push(`| ${flow.subject} | ${flow.questions} | ${flow.answeredPositions} | ${repeats} | pass |`);
  });
  lines.push("", "Both version-1 and changed-field-schema recovery cases used exact, nonempty two-item sentinel queues plus nonempty lastId values for every slot. The harness deep-compared the exact serialized active/history values after reload and first confirmation, then compared the exact expected one-item queues/new lastIds after replacement.");
  lines.push("", "## Print evidence", "", "| Artifact | Pages | A4 MediaBox + CropBox pages | PDF | First-page decoded raster |", "|---|---:|---:|---|---|");
  result.prints.forEach((entry) => lines.push(`| ${entry.name} | ${entry.pages} | ${entry.a4Pages} | \`${entry.file}\` | ${entry.firstPageRaster.width}×${entry.firstPageRaster.height}, \`${entry.firstPageRaster.hash}\` |`));
  lines.push("", "Before every subject print, a real exam was graded, its solution/comparison revealed, and manual override details opened. Every asserted selector had a nonzero inventory; effective hidden state was then checked through ancestors for screen controls, answer/facit, grade, solution/comparison and override/manual UI. Every question retained a measured work box; every included diagram had a non-zero readable print rectangle. All MediaBox and CropBox dimensions were within 0.75 pt of portrait A4, and the 96 dpi raster aspect matched A4 within 0.002.");
  lines.push("", "## Chemistry formula sheet", "", `- Source SHA-256: \`${result.formula.sha256}\``, `- Loaded dimensions: ${result.formula.dimensions.width}×${result.formula.dimensions.height}`, `- Printed pages: ${result.formula.printPages}`, `- Embedded decoded pixel hash matches source: ${result.formula.embeddedPixelMatch ? "yes" : "no"}`);
  lines.push("", "Dialog evidence includes initial focus, Escape/focus return, close-button focus return, complete desktop/mobile forward and reverse wrap, 50–300% zoom clamps, fit reset, wheel and arrow-key panning, and formula-only print mode. Formula-only print also proved non-formula page content existed and was effectively hidden while dialog/image content remained visible.");
  lines.push("", "## Check result", "", `- Passed leaves: ${result.summary.passed}`, `- Failed leaves: ${result.summary.failed}`, `- Subject flows: ${result.summary.subjectFlows}`, `- Page/viewport combinations: ${result.summary.viewports}`, `- Mobile runtime states: ${result.states.length}`, `- Radio cases audited: ${result.summary.radioCases}`, `- Focus paint checks: ${result.summary.focusPaintChecks}`, `- Contrast samples: ${result.summary.contrastSamples}`, `- Print artifacts: ${result.summary.prints}`);
  lines.push("", "## Limitations", "", "The harness validates the local app in the installed headless Google Chrome build and inspects generated PDFs with Poppler. It does not emulate a screen reader's speech output or a physical printer's device-specific margins.", "");
  return lines.join("\n");
}

async function runBrowserFlow(options) {
  const settings = Object.assign({ outputDirectory: DEFAULT_OUTPUT, writeEvidence: true }, options || {});
  const temporaryOutput = !settings.writeEvidence && !options?.outputDirectory;
  const outputDirectory = temporaryOutput ? fs.mkdtempSync(path.join(os.tmpdir(), "ks-browser-flow-")) : path.resolve(settings.outputDirectory);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const checks = {};
  const details = [];
  const record = recorder(checks, details);
  const layouts = [];
  const flows = [];
  const keyboardResults = [];
  const formulaSequences = [];
  const states = [];
  const prints = [];
  const externalRequests = [];
  const consoleErrors = [];
  let chrome = null;
  let sessionId = null;
  const progress = (label) => {
    if (process.env.KS_BROWSER_FLOW_PROGRESS === "1") process.stderr.write(`[browser-flow] ${label}\n`);
  };
  try {
    progress("launch");
    chrome = await launchChrome();
    const connection = chrome.connection;
    const version = await connection.send("Browser.getVersion");
    const target = await connection.send("Target.createTarget", { url: "about:blank" });
    const attached = await connection.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    sessionId = attached.sessionId;
    await Promise.all([
      connection.send("Page.enable", {}, sessionId),
      connection.send("Runtime.enable", {}, sessionId),
      connection.send("Network.enable", {}, sessionId),
      connection.send("Log.enable", {}, sessionId)
    ]);
    connection.on("Network.requestWillBeSent", (message) => {
      if (message.sessionId !== sessionId) return;
      const url = message.params.request.url;
      if (/^https?:/u.test(url)) externalRequests.push(url);
    });
    connection.on("Runtime.exceptionThrown", (message) => {
      if (message.sessionId === sessionId) consoleErrors.push(message.params.exceptionDetails.text || "uncaught exception");
    });
    connection.on("Runtime.consoleAPICalled", (message) => {
      if (message.sessionId === sessionId && ["error", "assert"].includes(message.params.type)) consoleErrors.push(message.params.type);
    });
    connection.on("Log.entryAdded", (message) => {
      if (message.sessionId === sessionId && message.params.entry.level === "error") consoleErrors.push(message.params.entry.text);
    });
    await installDeterminism(connection, sessionId);

    for (const viewportKey of Object.keys(VIEWPORTS)) {
      progress(`hub ${viewportKey}`);
      await auditHub(connection, sessionId, viewportKey, record);
    }
    for (const pageKey of ["math", "physics", "chemistry"]) {
      progress(`flow ${pageKey}`);
      await runSubjectFlow(connection, sessionId, pageKey, record, flows);
    }
    progress("recovery");
    await runRecoveryFlows(connection, sessionId, record);
    progress("formula");
    const formulaSource = await formulaDialogFlow(connection, sessionId, record, formulaSequences);
    for (const pageKey of Object.keys(PAGES)) {
      for (const viewportKey of Object.keys(VIEWPORTS)) {
        progress(`layout ${pageKey} ${viewportKey}`);
        await auditPageViewport(connection, sessionId, pageKey, viewportKey, record, layouts, keyboardResults);
      }
    }
    progress("mobile states");
    await runMobileStateFlows(connection, sessionId, record, states);
    progress("print");
    await printFlows(connection, sessionId, outputDirectory, record, prints);
    progress("report");

    record(["environment", "external_network"], externalRequests.length === 0, JSON.stringify(externalRequests));
    record(["environment", "console_errors"], consoleErrors.length === 0, JSON.stringify(consoleErrors));
    const formulaBuffer = fs.readFileSync(FORMULA_PATH);
    const formulaPrint = prints.find((entry) => entry.name === "Kemins formelblad");
    const counts = leafCounts(checks);
    const result = {
      schemaVersion: 1,
      date: new Date().toISOString(),
      chrome: { product: version.product, revision: version.revision, protocolVersion: version.protocolVersion },
      urls: Object.fromEntries(Object.entries(PAGES).map(([keyName, page]) => [keyName, pageUrl(page)])),
      checks,
      details,
      layouts,
      flows,
      keyboardResults,
      formulaSequences,
      states,
      prints,
      formula: {
        sha256: sha256(formulaBuffer),
        dimensions: { width: formulaSource.width, height: formulaSource.height },
        printPages: formulaPrint.pages,
        embeddedPixelMatch: Boolean(formulaPrint.embeddedImage) && formulaPrint.embeddedImage.hash === decodedPixelHash(formulaBuffer).hash
      },
      networkRequests: Array.from(new Set(externalRequests)),
      consoleErrors,
      summary: {
        ...counts,
        viewports: layouts.length,
        subjectFlows: flows.length,
        prints: prints.length,
        radioCases: layouts.concat(states).reduce((sum, entry) => sum + (entry.audit ? entry.audit.radioCases : entry.dom.radioCases), 0),
        focusPaintChecks: layouts.concat(states).reduce((sum, entry) => sum + entry.focus.paints.length, 0),
        contrastSamples: layouts.concat(states).reduce((sum, entry) => sum + entry.contrast.samples.length, 0),
        externalRequests: externalRequests.length,
        consoleErrors: consoleErrors.length
      }
    };
    record(["environment", "formula_hash"], result.formula.sha256 === FORMULA_SHA256, result.formula.sha256);
    const finalCounts = leafCounts(checks);
    result.summary.passed = finalCounts.passed;
    result.summary.failed = finalCounts.failed;
    if (settings.writeEvidence) {
      fs.writeFileSync(path.join(outputDirectory, "result.json"), JSON.stringify(result, null, 2) + "\n");
      fs.writeFileSync(EVIDENCE_PATH, evidenceMarkdown(result));
    }
    return result;
  } finally {
    if (chrome) {
      chrome.connection.close();
      if (!chrome.browser.killed) chrome.browser.kill("SIGTERM");
      fs.rmSync(chrome.profileDirectory, { recursive: true, force: true });
    }
    if (temporaryOutput) fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runBrowserFlow().then((result) => {
    process.stdout.write(JSON.stringify({
      passed: result.summary.passed,
      failed: result.summary.failed,
      viewports: result.summary.viewports,
      subjectFlows: result.summary.subjectFlows,
      prints: result.summary.prints,
      externalRequests: result.summary.externalRequests,
      consoleErrors: result.summary.consoleErrors,
      evidence: EVIDENCE_PATH,
      output: DEFAULT_OUTPUT
    }, null, 2) + "\n");
    if (!allChecksPass(result.checks) || result.summary.failed) process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(error.stack + "\n");
    process.exitCode = 1;
  });
}

module.exports = {
  runBrowserFlow,
  allChecksPass,
  leafCounts,
  descriptorsAreUnique,
  requiredInventoryPresent,
  isA4PageBox,
  VIEWPORTS,
  PAGES
};
