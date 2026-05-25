#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const SCHEMA = "zephyrlabs-bga-replay-crawler-v1";

function usage() {
  return [
    "Usage:",
    "  node splendor/scripts/bga-splendor-replay-crawler.mjs --table <BGA_TABLE_ID> [--out ./bga-replays] [--manual] [--headless] [--wait-ms 60000]",
    "",
    "Notes:",
    "  - The script opens the official BGA review page in a local browser.",
    "  - Log in on BGA in that browser if prompted.",
    "  - Optional server-side cookie auth: BGA_COOKIE or BGA_COOKIE_FILE.",
    "  - Optional server-side env login: BGA_USERNAME and BGA_PASSWORD.",
    "  - Optional server-side account pool: BGA_ACCOUNT_POOL as user=pass entries separated by semicolon, comma, or newline.",
    "  - Optional local cookie capture: BGA_WRITE_COOKIE_FILE.",
    "  - Your BGA password is never sent to zephyrlabs.cloud or this repo.",
    "  - Output is browser-visible BGA replay data with base-game compatibility metadata."
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    table: "",
    out: "bga-replays",
    profile: ".bga-crawler-profile",
    manual: false,
    headless: false,
    maxSteps: 400,
    waitMs: 60000
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--table" || value === "-t") args.table = argv[++index] || "";
    else if (value === "--out" || value === "-o") args.out = argv[++index] || args.out;
    else if (value === "--profile") args.profile = argv[++index] || args.profile;
    else if (value === "--manual") args.manual = true;
    else if (value === "--headless") args.headless = true;
    else if (value === "--max-steps") args.maxSteps = Number(argv[++index] || args.maxSteps);
    else if (value === "--wait-ms") args.waitMs = Number(argv[++index] || args.waitMs);
    else if (value === "--help" || value === "-h") {
      console.log(usage());
      process.exit(0);
    }
  }
  args.table = String(args.table || "").replace(/[^\d]/g, "");
  return args;
}

function readBgaCredentials() {
  return {
    username: process.env.BGA_USERNAME || process.env.BGA_LOGIN_ID || process.env.BGA_USER || "",
    password: process.env.BGA_PASSWORD || process.env.BGA_PASS || ""
  };
}

function parseBgaAccountPool(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : parsed.accounts;
    if (!Array.isArray(rows)) throw new Error("BGA_ACCOUNT_POOL JSON must be an array or an object with an accounts array.");
    return rows.map((row) => ({
      username: String(row.username || row.user || row.login || "").trim(),
      password: String(row.password || row.pass || "").trim()
    })).filter(hasBgaCredentials);
  }
  return text
    .split(/[\n;,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const splitAt = entry.includes("=") ? entry.indexOf("=") : entry.indexOf(":");
      if (splitAt <= 0) return null;
      return {
        username: entry.slice(0, splitAt).trim(),
        password: entry.slice(splitAt + 1).trim()
      };
    })
    .filter(hasBgaCredentials);
}

function readBgaCredentialPool() {
  const pool = parseBgaAccountPool(process.env.BGA_ACCOUNT_POOL || process.env.BGA_ACCOUNTS || process.env.BGA_CREDENTIALS || "");
  const single = readBgaCredentials();
  if (hasBgaCredentials(single) && !pool.some((entry) => entry.username === single.username)) {
    pool.unshift(single);
  }
  return pool;
}

async function readBgaCookieHeader() {
  var direct = process.env.BGA_COOKIE || process.env.BGA_COOKIE_HEADER || "";
  if (direct.trim()) return direct.trim();
  var filePath = process.env.BGA_COOKIE_FILE || "";
  if (!filePath.trim()) return "";
  try {
    return (await readFile(path.resolve(process.cwd(), filePath), "utf8")).trim();
  } catch (error) {
    throw new Error(`Could not read BGA_COOKIE_FILE: ${error.message}`);
  }
}

function hasBgaCredentials(credentials) {
  return !!(credentials && credentials.username && credentials.password);
}

function isBgaReplayQuotaError(error) {
  return /BGA replay quota reached|replay quota|replay.*limit|limit.*replay/i.test(error && error.message ? error.message : String(error || ""));
}

function accountLabel(credentials) {
  return credentials && credentials.username ? credentials.username : "browser profile";
}

function safeProfileSegment(value) {
  return String(value || "account")
    .replace(/[^a-z0-9_.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "account";
}

function profileDirForAttempt(baseProfileDir, credentials, attemptIndex, attemptCount) {
  if (!hasBgaCredentials(credentials)) return baseProfileDir;
  return path.join(baseProfileDir, safeProfileSegment(credentials.username || `account-${attemptIndex + 1}`));
}

function parseCookieHeader(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const splitAt = entry.indexOf("=");
      if (splitAt <= 0) return null;
      const name = entry.slice(0, splitAt).trim();
      const value = entry.slice(splitAt + 1).trim();
      if (!name) return null;
      return { name, value };
    })
    .filter(Boolean);
}

async function applyBgaCookieHeader(context, cookieHeader) {
  const pairs = parseCookieHeader(cookieHeader);
  if (!pairs.length) return false;
  const cookies = pairs.flatMap((pair) => [
    {
      name: pair.name,
      value: pair.value,
      url: "https://boardgamearena.com",
      secure: true,
      sameSite: "Lax"
    },
    {
      name: pair.name,
      value: pair.value,
      url: "https://en.boardgamearena.com",
      secure: true,
      sameSite: "Lax"
    }
  ]);
  await context.addCookies(cookies);
  await context.setExtraHTTPHeaders({ Cookie: pairs.map((pair) => `${pair.name}=${pair.value}`).join("; ") });
  return true;
}

async function cookieHeaderFromContext(context) {
  const cookies = await context.cookies(["https://boardgamearena.com", "https://en.boardgamearena.com"]);
  const seen = new Set();
  return cookies
    .filter((cookie) => cookie && cookie.name && cookie.value)
    .filter((cookie) => {
      const key = `${cookie.name}=${cookie.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function maybeWriteCookieHeader(context) {
  const target = process.env.BGA_WRITE_COOKIE_FILE || "";
  if (!target.trim()) return;
  const cookieHeader = await cookieHeaderFromContext(context);
  if (!cookieHeader) return;
  const outputPath = path.resolve(process.cwd(), target);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, cookieHeader, "utf8");
  console.log(`Saved BGA cookie header to ${outputPath}`);
}

function headersToObject(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) out[key] = value;
  return out;
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function looksReplayRelated(url, contentType, text) {
  const lowerUrl = String(url || "").toLowerCase();
  if (!lowerUrl.includes("boardgamearena.com")) return false;
  if ((contentType || "").toLowerCase().includes("json")) return true;
  if (!text) return false;
  const sample = text.slice(0, 200000);
  return /gamedatas|gamereview|replay|move_id|notification|table_id|splendor/i.test(sample);
}

function safeJsonClone(value, maxDepth = 8) {
  const seen = new WeakSet();
  function walk(input, depth) {
    if (depth > maxDepth) return "[MaxDepth]";
    if (input === null || typeof input !== "object") return input;
    if (seen.has(input)) return "[Circular]";
    seen.add(input);
    if (Array.isArray(input)) return input.slice(0, 500).map((item) => walk(item, depth + 1));
    const out = {};
    for (const key of Object.keys(input).slice(0, 500)) {
      let next;
      try {
        next = input[key];
      } catch {
        next = "[Unreadable]";
      }
      if (typeof next !== "function") out[key] = walk(next, depth + 1);
    }
    return out;
  }
  return walk(value, 0);
}

async function loadChromium(repoRoot) {
  try {
    const mod = await import("playwright");
    return mod.chromium;
  } catch (firstError) {
    const candidates = [
      process.env.PLAYWRIGHT_NODE_MODULES,
      path.join(repoRoot, "node_modules"),
      path.join(repoRoot, "server", "node_modules")
    ].filter(Boolean);
    for (const nodeModules of candidates) {
      try {
        const requireFrom = createRequire(path.join(nodeModules, "package.json"));
        return requireFrom("playwright").chromium;
      } catch {
        // Try the next dependency location.
      }
    }
    throw firstError;
  }
}

async function collectSnapshot(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
      return await page.evaluate(() => {
    function cloneVisible(value, maxDepth) {
      const seen = new WeakSet();
      function walk(input, depth) {
        if (depth > maxDepth) return "[MaxDepth]";
        if (input === null || typeof input !== "object") return input;
        if (seen.has(input)) return "[Circular]";
        seen.add(input);
        if (Array.isArray(input)) return input.slice(0, 500).map((item) => walk(item, depth + 1));
        const out = {};
        Object.keys(input).slice(0, 500).forEach((key) => {
          let next;
          try {
            next = input[key];
          } catch {
            next = "[Unreadable]";
          }
          if (typeof next !== "function") out[key] = walk(next, depth + 1);
        });
        return out;
      }
      return walk(value, 0);
    }
    const gameui = window.gameui || window.gameui_playback || null;
    const logSelectors = [
      "#logs .log",
      "#logs li",
      ".gamelogreview .log",
      ".gamelogreview li",
      ".chatwindowlogs_zone .log",
      ".log_history_status"
    ];
    const logs = [];
    for (const selector of logSelectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
        if (text && !logs.includes(text)) logs.push(text);
      });
    }
    return {
      title: document.title,
      url: location.href,
      gameui: gameui ? cloneVisible({
        game_name: gameui.game_name,
        game_id: gameui.game_id,
        table_id: gameui.table_id,
        gamedatas: gameui.gamedatas,
        player_id: gameui.player_id,
        player_name: gameui.player_name
      }, 10) : null,
      logs
    };
      });
    } catch (error) {
      if (!/Execution context was destroyed|navigation|Target closed/i.test(error.message || "") || attempt === 3) throw error;
      await page.waitForTimeout(800);
    }
  }
  return { title: "", url: page.url(), gameui: null, logs: [] };
}

async function clickNextReplayControl(page) {
  return page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button, a, .archivecontrol, [role='button']"));
    const usable = candidates.filter((node) => {
      const text = String(node.textContent || "").trim().toLowerCase();
      const label = String(node.getAttribute("aria-label") || node.getAttribute("title") || node.id || node.className || "").toLowerCase();
      const joined = `${text} ${label}`;
      if (node.disabled || node.getAttribute("aria-disabled") === "true") return false;
      if (/previous|prev|back|undo|precedent|zuruck|anterior|前|戻/.test(joined)) return false;
      return /next|following|suivant|weiter|siguiente|avance|step|play|fast|>|»|次|進/.test(joined);
    });
    if (!usable.length) return false;
    usable[0].click();
    return true;
  });
}

async function assertNotLoginOrLobby(page) {
  const current = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    body: document.body ? document.body.innerText.slice(0, 2000) : ""
  }));
  if (
    /\/account|\/lobby/i.test(current.url) ||
    /login|log in|sign in/i.test(current.title) ||
    /login|log in|sign in/i.test(current.body)
  ) {
    throw new Error("BGA redirected to login or lobby. Log in with the crawler browser profile and make sure this account can view the table replay.");
  }
  if (!/gamereview|\/archive\/replay/i.test(current.url)) {
    throw new Error(`BGA did not stay on a BGA review or replay page. Current URL: ${current.url}`);
  }
}

async function clearPenaltyIfPresent(page, targetUrl, maxClicks = 10) {
  for (let index = 0; index < maxClicks; index += 1) {
    const current = await page.evaluate(() => ({
      url: location.href,
      body: document.body ? document.body.innerText.slice(0, 2000) : ""
    })).catch(() => ({ url: page.url(), body: "" }));
    if (!/\/penalty/i.test(current.url) && !/未能完成某一场游戏|未能完成某一場遊戲|penalty/i.test(current.body)) {
      return index;
    }
    const clicked = await page.evaluate(() => {
      const link = document.querySelector("a.exit_penalty");
      if (!link) return false;
      link.click();
      return true;
    }).catch(() => false);
    if (!clicked) {
      throw new Error(`BGA penalty page blocked replay access and no continue button was found. Current URL: ${current.url}`);
    }
    await page.waitForTimeout(1800);
    if (targetUrl) {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(1800);
    }
  }
  throw new Error("BGA penalty page kept reappearing after 10 continue clicks.");
}

async function assertBgaReplayAccessible(page) {
  const current = await page.evaluate(() => ({
    title: document.title,
    body: document.body ? document.body.innerText.slice(0, 4000) : ""
  }));
  const text = `${current.title}\n${current.body}`;
  if (/reached\s+(the\s+)?limit.*replay|replay.*limit|你已经达到上限（replay）|你已經達到上限（replay）|达到上限.*replay|達到上限.*replay/i.test(text)) {
    throw new Error("BGA replay quota reached for this account. Wait for the replay quota to reset or use an account with replay access.");
  }
  if (/registered more than 24 hours and have played at least 2 games/i.test(text)) {
    throw new Error("BGA blocked replay access for this account: the account must be registered for more than 24 hours and must have played at least 2 games.");
  }
  if (/go premium|premium-only|premium only|support us & go premium/i.test(text) && !/replay|archive|logs|move/i.test(text)) {
    throw new Error("BGA blocked replay access for this account. Premium access or additional account eligibility may be required.");
  }
}

function responseHasReplayData(response) {
  if (!response) return false;
  const parsed = response.parsed_json;
  if (/\/archive\/archive\/logs\.html/i.test(response.url || "")) {
    return !!(parsed && parsed.data && Array.isArray(parsed.data.logs));
  }
  if (parsed && parsed.data && Array.isArray(parsed.data.logs)) return true;
  if (parsed && Array.isArray(parsed.logs)) return true;
  return false;
}

async function pageHasReplaySurface(page) {
  return page.evaluate(() => {
    if (window.gameui || window.gameui_playback) return true;
    const text = document.body ? document.body.innerText : "";
    if (/replay|archive|logs|turn|move|spectator|review/i.test(text)) return true;
    if (/重播|遊戲日誌|游戏日志|行動|行动|選擇你的視角|选择你的视角|游戏结束|遊戲結束/.test(text)) return true;
    if (document.querySelector(".choosePlayerLink, #gamelogs, #logs, .gamelogreview")) return true;
    return false;
  }).catch(() => false);
}

async function pageHasBgaGamedatas(page) {
  return page.evaluate(() => {
    const gameui = window.gameui || window.gameui_playback || null;
    return !!(gameui && gameui.gamedatas && gameui.gamedatas.market && gameui.gamedatas.carddb);
  }).catch(() => false);
}

async function waitForReplayData(page, responses, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (responses.some(responseHasReplayData)) return;
    if (await pageHasReplaySurface(page)) return;
    await page.waitForTimeout(350);
  }
  throw new Error(`BGA review page did not load usable replay data within ${timeoutMs}ms. Login, permission, or Premium access may be required.`);
}

async function waitForBgaGamedatas(page, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await pageHasBgaGamedatas(page)) return true;
    await page.waitForTimeout(500);
  }
  throw new Error(`BGA replay page did not expose gameui.gamedatas within ${timeoutMs}ms. The table may be unavailable, unsupported, or still loading.`);
}

async function findArchiveReplayUrl(page, tableId) {
  return page.evaluate((targetTableId) => {
    if (/\/archive\/replay/i.test(location.href)) return location.href;
    const links = Array.from(document.querySelectorAll("a[href*='/archive/replay/'], a.choosePlayerLink"));
    for (const link of links) {
      const raw = link.getAttribute("href") || "";
      if (!raw) continue;
      const url = new URL(raw, location.href);
      if (!/\/archive\/replay/i.test(url.href)) continue;
      if (String(targetTableId || "") && url.searchParams.get("table") !== String(targetTableId)) continue;
      return url.href;
    }
    return "";
  }, String(tableId || "")).catch(() => "");
}

async function waitForArchiveLogsResponse(page, responses, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (responses.some(responseHasReplayData)) return true;
    await page.waitForTimeout(350);
  }
  return false;
}

async function fetchArchiveLogs(page, tableId, responses) {
  const alreadyCaptured = responses.some(responseHasReplayData);
  if (alreadyCaptured) return;
  const relativeUrl = `/archive/archive/logs.html?table=${encodeURIComponent(tableId)}&translated=true&dojo.preventCache=${Date.now()}`;
  const captured = await page.evaluate(async (url) => {
    const headers = { "x-requested-with": "XMLHttpRequest" };
    if (window.bgaConfig && window.bgaConfig.requestToken) {
      headers["x-request-token"] = window.bgaConfig.requestToken;
    }
    const response = await fetch(url, {
      credentials: "include",
      headers
    });
    const text = await response.text();
    let parsedJson = null;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      // Keep raw text if BGA changes this endpoint.
    }
    return {
      url: new URL(url, location.href).href,
      status: response.status,
      content_type: response.headers.get("content-type") || "",
      captured_at: new Date().toISOString(),
      parsed_json: parsedJson,
      text
    };
  }, relativeUrl);
  if (captured && looksReplayRelated(captured.url, captured.content_type, captured.text)) {
    responses.push(captured);
  }
}

async function loginRequired(page) {
  const current = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    body: document.body ? document.body.innerText.slice(0, 3000) : ""
  }));
  return (
    /\/account|\/lobby/i.test(current.url) ||
    /login|log in|sign in/i.test(current.title) ||
    /Login to Board Game Arena|Email or username|Already have a BGA account/i.test(current.body)
  );
}

async function loginWithBgaCredentials(page, credentials, reviewUrl) {
  if (!hasBgaCredentials(credentials)) return false;
  await page.goto("https://boardgamearena.com/account?page=login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  const result = await page.evaluate(async ({ username, password }) => {
    function formBody(data) {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        params.set(key, value == null ? "" : String(value));
      });
      return params.toString();
    }
    async function postJson(path, data) {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest"
        },
        body: formBody(data)
      });
      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        // The caller only needs sanitized status details.
      }
      return { status: response.status, json, text: text.slice(0, 300) };
    }
    const tokenResponse = await postJson("/account/auth/getRequestToken.html", { bgapp: "bga" });
    const requestToken = tokenResponse && tokenResponse.json && tokenResponse.json.data
      ? tokenResponse.json.data.request_token
      : "";
    if (!requestToken) {
      return { success: false, message: "BGA request token was not returned.", token_status: tokenResponse.status };
    }
    const loginResponse = await postJson("/account/auth/loginUserWithPassword.html", {
      username,
      password,
      remember_me: "true",
      request_token: requestToken
    });
    const data = loginResponse && loginResponse.json && loginResponse.json.data ? loginResponse.json.data : {};
    return {
      success: !!data.success,
      failed: !!data.failed,
      wait_until: data.wait_until || null,
      message: data.message || "",
      status: loginResponse.status,
      code: loginResponse && loginResponse.json ? loginResponse.json.code : null
    };
  }, { username: credentials.username, password: credentials.password });
  if (!result || !result.success) {
    throw new Error(result && result.message ? `BGA login failed: ${result.message}` : "BGA login failed through the auth API.");
  }
  await page.goto(reviewUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1800);
  return !(await loginRequired(page));
}

function summarizeExpansionFlags(payload) {
  const patterns = [
    { label: "Silk Road", re: /silk[_\-\s]?road|silkroad/i },
    { label: "Cities", re: /cities|city/i },
    { label: "Orient", re: /orient/i },
    { label: "Trading", re: /trading/i },
    { label: "Strongholds", re: /stronghold/i },
    { label: "Expansion", re: /expansion|extension/i }
  ];
  const active = [];
  const inactive = [];
  const references = [];

  function labelFor(value) {
    const text = String(value || "");
    const match = patterns.find((entry) => entry.re.test(text));
    return match ? match.label : "";
  }

  function isActive(value) {
    if (value === true) return true;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") return /^(true|1|yes|on|enabled|active)$/i.test(value.trim());
    return false;
  }

  function isInactive(value) {
    if (value === false || value === null) return true;
    if (typeof value === "number") return value === 0;
    if (typeof value === "string") return /^(false|0|no|off|disabled|inactive|)$/i.test(value.trim());
    return false;
  }

  function pushUnique(target, entry) {
    if (!target.some((item) => item.path === entry.path && item.label === entry.label)) {
      target.push(entry);
    }
  }

  function walk(value, pathName) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.slice(0, 1000).forEach((item, index) => walk(item, `${pathName}[${index}]`));
      return;
    }
    Object.entries(value).forEach(([key, child]) => {
      const path = pathName ? `${pathName}.${key}` : key;
      const keyLabel = labelFor(key);
      if (keyLabel && (typeof child !== "object" || child === null)) {
        const entry = { label: keyLabel, path, value: child };
        if (isActive(child)) pushUnique(active, entry);
        else if (isInactive(child)) pushUnique(inactive, entry);
        else pushUnique(references, entry);
      } else if (typeof child === "string") {
        const referenceLabel = labelFor(child);
        if (referenceLabel) pushUnique(references, { label: referenceLabel, path, value: child.slice(0, 160) });
      }
      walk(child, path);
    });
  }

  walk(payload, "");
  return { active, inactive, references };
}

function detectCompatibility(payload) {
  const text = JSON.stringify(payload).toLowerCase();
  const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
  const lastSnapshot = snapshots.length ? snapshots[snapshots.length - 1] : {};
  const gameui = lastSnapshot && lastSnapshot.gameui ? lastSnapshot.gameui : {};
  const gameName = String(gameui.game_name || lastSnapshot.title || "").toLowerCase();
  const expansionFlags = summarizeExpansionFlags(payload);
  const hasExpansion = expansionFlags.active.length > 0;
  const maybeSplendor = /splendor|璀璨|宝石|寶石|宝石の煌き/.test(gameName) || /splendor|璀璨|宝石|寶石|宝石の煌き/.test(text);
  const activeSummary = expansionFlags.active.map((entry) => `${entry.label} at ${entry.path}`).join("; ");
  return {
    maybe_splendor: maybeSplendor,
    has_expansion_hint: hasExpansion,
    expansion_detection: expansionFlags,
    importable_by_current_zephyrlabs_viewer: maybeSplendor && !hasExpansion,
    reason: hasExpansion
      ? `Active expansion flag detected: ${activeSummary}. ZephyrLabs currently supports only base-game Splendor captures.`
      : "No active expansion flag was detected. Expansion wording in descriptive text is treated as a reference and ignored."
  };
}

async function crawlWithCredential({ args, chromium, outputDir, profileDir, cookieHeader, credentials, attemptIndex, attemptCount }) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");
  const responses = [];
  const launchOptions = {
    headless: args.headless,
    viewport: { width: 1440, height: 1000 }
  };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  }
  const attemptProfileDir = profileDirForAttempt(profileDir, credentials, attemptIndex, attemptCount);
  if (attemptCount > 1) {
    console.log(`Using BGA account ${attemptIndex + 1}/${attemptCount}: ${accountLabel(credentials)}`);
  }
  let context = null;
  try {
  context = await chromium.launchPersistentContext(attemptProfileDir, launchOptions);
  const page = context.pages()[0] || await context.newPage();
  if (cookieHeader && !hasBgaCredentials(credentials)) {
    await applyBgaCookieHeader(context, cookieHeader);
  }

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const headers = headersToObject(response.headers());
      const contentType = headers["content-type"] || "";
      const text = await response.text();
      if (!looksReplayRelated(url, contentType, text)) return;
      responses.push({
        url,
        status: response.status(),
        content_type: contentType,
        captured_at: new Date().toISOString(),
        parsed_json: parseMaybeJson(text),
        text
      });
    } catch {
      // Ignore binary, opaque, or consumed responses.
    }
  });

  const reviewUrl = `https://boardgamearena.com/gamereview?table=${encodeURIComponent(args.table)}`;
  console.log(`Opening ${reviewUrl}`);
  await page.goto(reviewUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  console.log("If BGA asks you to log in, complete login in the opened browser window.");
  console.log("When the replay page is visible, the crawler will continue automatically.");
  await page.waitForTimeout(1800);
  await clearPenaltyIfPresent(page, reviewUrl);
  if (await loginRequired(page)) {
    if (hasBgaCredentials(credentials)) {
      const loggedIn = await loginWithBgaCredentials(page, credentials, reviewUrl);
      if (!loggedIn) {
        throw new Error("BGA automatic login did not complete. The account may need verification, captcha, or manual login in the crawler profile.");
      }
      await clearPenaltyIfPresent(page, reviewUrl);
      await maybeWriteCookieHeader(context);
    }
  }
  await clearPenaltyIfPresent(page, reviewUrl);
  await assertNotLoginOrLobby(page);
  await maybeWriteCookieHeader(context);
  await assertBgaReplayAccessible(page);

  await waitForReplayData(page, responses, args.waitMs);
  await assertNotLoginOrLobby(page);
  await assertBgaReplayAccessible(page);
  const archiveReplayUrl = await findArchiveReplayUrl(page, args.table);
  if (archiveReplayUrl && archiveReplayUrl !== page.url()) {
    console.log(`Opening archive replay ${archiveReplayUrl}`);
    await page.goto(archiveReplayUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1800);
    await clearPenaltyIfPresent(page, archiveReplayUrl);
    await assertNotLoginOrLobby(page);
    await assertBgaReplayAccessible(page);
  }
  await waitForBgaGamedatas(page, args.waitMs);
  if (!(await waitForArchiveLogsResponse(page, responses, Math.min(args.waitMs, 15000)))) {
    await fetchArchiveLogs(page, args.table, responses).catch(() => {});
  }

  const snapshots = [];
  snapshots.push(await collectSnapshot(page));

  if (!args.manual) {
    for (let step = 0; step < args.maxSteps; step += 1) {
      const clicked = await clickNextReplayControl(page);
      if (!clicked) break;
      await page.waitForTimeout(450);
      const snapshot = await collectSnapshot(page);
      snapshots.push(snapshot);
      const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : {};
      const lastLogs = previousSnapshot && previousSnapshot.logs ? previousSnapshot.logs : [];
      if (
        step > 8 &&
        snapshot.logs.length === lastLogs.length &&
        responses.length > 0
      ) {
        break;
      }
    }
  } else {
    console.log("Manual mode: play or step through the replay in the browser.");
    console.log("Press Enter here when the replay data you need has loaded.");
    await new Promise((resolve) => process.stdin.once("data", resolve));
    snapshots.push(await collectSnapshot(page));
  }

  const payload = {
    schema: SCHEMA,
    source: "boardgamearena-gamereview-local-playwright-crawler",
    table_id: args.table,
    review_url: reviewUrl,
    exported_at: new Date().toISOString(),
    note: "Raw BGA browser-visible replay capture. It may require a converter before it can be replayed in ZephyrLabs Gem Table.",
    snapshots: safeJsonClone(snapshots, 12),
    responses: safeJsonClone(responses, 12)
  };
  payload.compatibility = detectCompatibility(payload);

  const outputPath = path.join(outputDir, `bga-table-${args.table}-replay.json`);
  await writeFile(outputPath, JSON.stringify(payload), "utf8");
  console.log(`Saved ${outputPath}`);
  console.log(`Repo script: ${path.relative(repoRoot, fileURLToPath(import.meta.url)).replace(/\\/g, "/")}`);
  return outputPath;
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.table) {
    console.error(usage());
    process.exit(1);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");
  const chromium = await loadChromium(repoRoot);
  const credentialPool = readBgaCredentialPool();
  const attempts = credentialPool.length ? credentialPool : [readBgaCredentials()];
  const cookieHeader = await readBgaCookieHeader();
  const outputDir = path.resolve(process.cwd(), args.out);
  const profileDir = path.resolve(process.cwd(), args.profile);
  await mkdir(outputDir, { recursive: true });

  let lastQuotaError = null;
  for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex += 1) {
    const credentials = attempts[attemptIndex];
    try {
      return await crawlWithCredential({
        args,
        chromium,
        outputDir,
        profileDir,
        cookieHeader,
        credentials,
        attemptIndex,
        attemptCount: attempts.length
      });
    } catch (error) {
      if (!isBgaReplayQuotaError(error) || attemptIndex >= attempts.length - 1) throw error;
      lastQuotaError = error;
      console.warn(`BGA replay quota reached for ${accountLabel(credentials)}; retrying table ${args.table} with the next configured account.`);
    }
  }
  throw lastQuotaError || new Error("BGA crawler did not run any account attempts.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
