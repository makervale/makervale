/** Tool search: type what you want to do in your own words; the best match comes first. */
import type { ToolDef } from "@/app/tools";
import { norm } from "@/ui/dom";

/** words that say nothing about the tool ("how do I make a hole" → "hole") */
const STOP = new Set(
  "how to a an the i want make do of on in with for my me it is some something can into this that eg".split(" "),
);
const NAME_WEIGHT = 6;
const SYNONYM_WEIGHT = 3;
const KEY_WEIGHT = 2;
const TEXT_WEIGHT = 1;
const WORD_START = 2;
const INSIDE_WORD = 1;
const SAME_STEM = 0.8;
const MIN_STEM = 3;
const MIN_STEMMED_TOKEN = 4;

const stemOf = (w: string): string => w.slice(0, Math.max(MIN_STEM, w.length - 2));

/** how well one query word matches one field: at a word start, inside a word, or by a shared stem */
export function tokenWeight(field: string, token: string): number {
  const i = field.indexOf(token);
  if (i >= 0) return i === 0 || field[i - 1] === " " || field[i - 1] === "-" ? WORD_START : INSIDE_WORD;
  if (token.length < MIN_STEMMED_TOKEN) return 0;
  const stem = stemOf(token);
  for (const w of field.split(/[\s,.;:()/–-]+/)) {
    if (w.length < MIN_STEM) continue;
    if (w.startsWith(stem) || (w.length >= MIN_STEMMED_TOKEN && token.startsWith(stemOf(w)))) return SAME_STEM;
  }
  return 0;
}

function fieldsOf(t: ToolDef, categoryName: string): [string, number][] {
  return [
    [norm(t.name), NAME_WEIGHT],
    ...t.synonyms.map((s): [string, number] => [norm(s), SYNONYM_WEIGHT]),
    [norm(t.summary), TEXT_WEIGHT],
    [norm(categoryName), TEXT_WEIGHT],
    [norm(t.key ?? ""), KEY_WEIGHT],
  ];
}

/** every query word must match somewhere; the score adds each word's best field */
export function score(t: ToolDef, query: string, categoryName = ""): number {
  const tokens = norm(query)
    .split(/\s+/)
    .filter((x) => x && !STOP.has(x));
  if (!tokens.length) return query.trim() ? 0 : 1;
  const fields = fieldsOf(t, categoryName);
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const [field, weight] of fields) if (field) best = Math.max(best, weight * tokenWeight(field, token));
    if (!best) return 0;
    total += best;
  }
  return total;
}

export function searchTools(tools: ToolDef[], query: string, categoryName: (id: string) => string): ToolDef[] {
  return tools
    .map((t) => [t, score(t, query, categoryName(t.category))] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}
