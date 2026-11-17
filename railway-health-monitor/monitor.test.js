import test from "node:test";
import assert from "node:assert/strict";
import { validateDataset } from "./monitor.js";

test("accepts complete contiguous Quran metadata and Somali translation coverage", () => {
  const issues = validateDataset({
    surahs: [
      { id: 1, verse_count: 2 },
      { id: 2, verse_count: 1 }
    ],
    verses: [
      { id: 1, surah_id: 1, verse_number: 1 },
      { id: 2, surah_id: 1, verse_number: 2 },
      { id: 3, surah_id: 2, verse_number: 1 }
    ],
    translations: [
      { verse_id: 1 },
      { verse_id: 2 },
      { verse_id: 3 }
    ]
  }, { surahCount: 2, verseCount: 3 });

  assert.deepEqual(issues, []);
});

test("detects missing verses, duplicate translations, and count mismatches", () => {
  const issues = validateDataset({
    surahs: [
      { id: 1, verse_count: 2 },
      { id: 2, verse_count: 1 }
    ],
    verses: [
      { id: 1, surah_id: 1, verse_number: 1 },
      { id: 3, surah_id: 2, verse_number: 1 }
    ],
    translations: [
      { verse_id: 1 },
      { verse_id: 1 },
      { verse_id: 3 }
    ]
  }, { surahCount: 2, verseCount: 3 });

  assert.ok(issues.some((issue) => issue.includes("Verse row count")));
  assert.ok(issues.some((issue) => issue.includes("Missing global verse id 2")));
  assert.ok(issues.some((issue) => issue.includes("Duplicate Somali translation for verse 1")));
  assert.ok(issues.some((issue) => issue.includes("Surah 1 has 1 verses")));
  assert.ok(issues.some((issue) => issue.includes("Missing Somali translation for verse 2")));
});
