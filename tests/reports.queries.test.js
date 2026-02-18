import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEmployeeProgressQuery,
  buildTopDifficultCardsQuery,
} from "../lib/reports/queries.js";

test("buildTopDifficultCardsQuery defaults and parameter order without deck", () => {
  const sql = buildTopDifficultCardsQuery();
  assert.match(sql.text, /FROM quiz_attempts/);
  assert.equal(sql.values.length, 2);
  assert.equal(sql.values[0], 3);
  assert.equal(sql.values[1], 20);
});

test("buildTopDifficultCardsQuery applies deck filter", () => {
  const sql = buildTopDifficultCardsQuery({ deckName: "elements", limit: 10, minAttempts: 2 });
  assert.match(sql.text, /WHERE deck_name = \$1/);
  assert.deepEqual(sql.values, ["elements", 2, 10]);
});

test("buildEmployeeProgressQuery applies limit and optional deck", () => {
  const sqlDefault = buildEmployeeProgressQuery();
  assert.equal(sqlDefault.values[0], 100);

  const sqlDeck = buildEmployeeProgressQuery({ deckName: "price_lines", limit: 50 });
  assert.match(sqlDeck.text, /WHERE m\.deck_name = \$1/);
  assert.deepEqual(sqlDeck.values, ["price_lines", 50]);
});
