import process from "node:process";

const PAGE_SIZE = 1000;
const EXPECTED_SURAHS = 114;
const EXPECTED_VERSES = 6236;
const TIMEOUT_MS = 20000;

export function validateDataset({ surahs, verses, translations }, expected = {}) {
  const expectedSurahs = expected.surahCount ?? EXPECTED_SURAHS;
  const expectedVerses = expected.verseCount ?? EXPECTED_VERSES;
  const issues = [];

  if (surahs.length !== expectedSurahs) {
    issues.push("Surah row count is " + surahs.length + "; expected " + expectedSurahs + ".");
  }

  const surahMap = new Map();
  for (const surah of surahs) {
    const id = Number(surah.id);
    if (surahMap.has(id)) issues.push("Duplicate surah id " + id + ".");
    surahMap.set(id, Number(surah.verse_count));
  }

  for (let id = 1; id <= expectedSurahs; id += 1) {
    if (!surahMap.has(id)) issues.push("Missing surah id " + id + ".");
  }

  const verseIds = new Set();
  const verseNumbersBySurah = new Map();
  for (const verse of verses) {
    const id = Number(verse.id);
    const surahId = Number(verse.surah_id);
    const verseNumber = Number(verse.verse_number);
    if (verseIds.has(id)) issues.push("Duplicate verse row id " + id + ".");
    verseIds.add(id);

    if (!surahMap.has(surahId)) {
      issues.push("Verse " + id + " references unknown surah " + surahId + ".");
      continue;
    }

    if (!verseNumbersBySurah.has(surahId)) verseNumbersBySurah.set(surahId, new Set());
    const numbers = verseNumbersBySurah.get(surahId);
    if (numbers.has(verseNumber)) {
      issues.push("Duplicate verse number " + verseNumber + " in surah " + surahId + ".");
    }
    numbers.add(verseNumber);
  }

  if (verses.length !== expectedVerses) {
    issues.push("Verse row count is " + verses.length + "; expected " + expectedVerses + ".");
  }

  for (let id = 1; id <= expectedVerses; id += 1) {
    if (!verseIds.has(id)) issues.push("Missing global verse id " + id + ".");
  }

  for (let surahId = 1; surahId <= expectedSurahs; surahId += 1) {
    const expectedCount = surahMap.get(surahId);
    const actualNumbers = verseNumbersBySurah.get(surahId) ?? new Set();
    if (actualNumbers.size !== expectedCount) {
      issues.push("Surah " + surahId + " has " + actualNumbers.size + " verses; metadata says " + expectedCount + ".");
      continue;
    }
    for (let number = 1; number <= expectedCount; number += 1) {
      if (!actualNumbers.has(number)) {
        issues.push("Surah " + surahId + " is missing verse number " + number + ".");
      }
    }
  }

  const translationIds = new Set();
  for (const translation of translations) {
    const verseId = Number(translation.verse_id);
    if (translationIds.has(verseId)) {
      issues.push("Duplicate Somali translation for verse " + verseId + ".");
    }
    translationIds.add(verseId);
  }

  if (translations.length !== expectedVerses) {
    issues.push("Somali translation row count is " + translations.length + "; expected " + expectedVerses + ".");
  }

  for (let id = 1; id <= expectedVerses; id += 1) {
    if (!translationIds.has(id)) issues.push("Missing Somali translation for verse " + id + ".");
  }

  return issues;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

async function requestJson(url, apiKey, range) {
  const headers = {
    apikey: apiKey,
    accept: "application/json"
  };
  if (range) {
    headers.Range = range;
    headers.Prefer = "count=exact";
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  if (!response.ok) {
    let code = "unknown";
    try {
      const body = await response.json();
      code = body.code ?? body.error ?? "unknown";
    } catch {}
    throw new Error("Supabase REST request failed: HTTP " + response.status + ", code " + code + ".");
  }

  return response;
}

async function readRows(baseUrl, apiKey, table, params) {
  const rows = [];
  let offset = 0;

  while (true) {
    const url = new URL(baseUrl + "/rest/v1/" + table);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const end = offset + PAGE_SIZE - 1;
    const response = await requestJson(url, apiKey, offset + "-" + end);
    const page = await response.json();

    if (!Array.isArray(page)) {
      throw new Error("Unexpected response shape from " + table + ".");
    }

    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += page.length;

    if (offset > 100000) throw new Error("Safety limit exceeded while reading " + table + ".");
  }

  return rows;
}

async function checkPrivateEndpoint(baseUrl, apiKey, table, column) {
  const url = new URL(baseUrl + "/rest/v1/" + table);
  url.searchParams.set("select", column);
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { apikey: apiKey, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (response.status === 401 || response.status === 403) {
      return { table, status: "PASS", detail: "Anonymous access denied." };
    }

    if (response.status === 404) {
      return { table, status: "WARN", detail: "Endpoint not exposed or not found; could not verify." };
    }

    if (!response.ok) {
      return { table, status: "WARN", detail: "HTTP " + response.status + "; could not verify." };
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return { table, status: "WARN", detail: "Unexpected response; could not verify." };
    }

    if (rows.length > 0) {
      return { table, status: "FAIL", detail: "Anonymous request returned at least one row." };
    }

    return { table, status: "PASS", detail: "No rows visible to anonymous requests." };
  } catch (error) {
    return { table, status: "WARN", detail: "Check failed: " + error.message };
  }
}

export async function runMonitor() {
  const baseUrl = requiredEnv("SUPABASE_URL").replace(/\/+$/, "");
  const apiKey = requiredEnv("SUPABASE_PUBLISHABLE_KEY");

  const [surahs, verses, translations, adhkarCategories, adhkarItems, reviewedTranslations] = await Promise.all([
    readRows(baseUrl, apiKey, "quran_surahs", { select: "id,verse_count", order: "id.asc" }),
    readRows(baseUrl, apiKey, "quran_verses", { select: "id,surah_id,verse_number", order: "id.asc" }),
    readRows(baseUrl, apiKey, "quran_translations", { select: "verse_id,is_reviewed", language_code: "eq.so", order: "verse_id.asc" }),
    readRows(baseUrl, apiKey, "adhkar_categories", { select: "id", is_active: "eq.true" }),
    readRows(baseUrl, apiKey, "adhkar_items", { select: "id", is_active: "eq.true" }),
    readRows(baseUrl, apiKey, "quran_translations", { select: "verse_id", language_code: "eq.so", is_reviewed: "eq.true" })
  ]);

  const contentIssues = validateDataset({ surahs, verses, translations });
  const reviewedCount = reviewedTranslations.length;
  const warnings = [];

  if (reviewedCount < translations.length) {
    warnings.push("Only " + reviewedCount + " of " + translations.length + " Somali translation rows are marked is_reviewed=true.");
  }

  const privateEndpoints = [
    ["profiles", "id"],
    ["user_progress", "id"],
    ["daily_goals", "id"],
    ["favorites", "adhkar_item_id"],
    ["reminders", "id"],
    ["quran_bookmarks", "verse_id"],
    ["quran_reading_progress", "user_id"],
    ["tasbih_counters", "id"],
    ["quran_khatmah_plans", "id"],
    ["quran_khatmah_reading_logs", "id"],
    ["quran_khatmah_daily_schedule", "plan_id"],
    ["quran_khatmah_plan_summary", "plan_id"]
  ];

  const privacyChecks = await Promise.all(
    privateEndpoints.map(([table, column]) => checkPrivateEndpoint(baseUrl, apiKey, table, column))
  );

  const failures = [];
  if (contentIssues.length > 0) failures.push(...contentIssues);
  for (const check of privacyChecks) {
    if (check.status === "FAIL") failures.push(check.table + ": " + check.detail);
    if (check.status === "WARN") warnings.push(check.table + ": " + check.detail);
  }

  return {
    monitor: "NUUR Read-only Health Monitor",
    checkedAt: new Date().toISOString(),
    result: failures.length > 0 ? "FAIL" : warnings.length > 0 ? "WARN" : "PASS",
    checks: {
      supabaseRestApi: "PASS",
      quranSurahs: surahs.length,
      quranVerses: verses.length,
      somaliTranslations: translations.length,
      somaliTranslationsMarkedReviewed: reviewedCount,
      activeAdhkarCategories: adhkarCategories.length,
      activeAdhkarItems: adhkarItems.length,
      privateEndpointChecks: privacyChecks
    },
    contentIssues,
    warnings,
    failures
  };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    const report = await runMonitor();
    console.log(JSON.stringify(report, null, 2));
    if (report.result === "FAIL") process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({
      monitor: "NUUR Read-only Health Monitor",
      checkedAt: new Date().toISOString(),
      result: "FAIL",
      error: error.message
    }, null, 2));
    process.exitCode = 1;
  }
}
