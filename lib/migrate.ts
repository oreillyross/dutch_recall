// Pure cache migrations (no browser APIs), so they can be unit tested.
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

function renamePairs(list: unknown): { value: unknown; changed: boolean } {
  if (!Array.isArray(list)) return { value: list, changed: false };
  let changed = false;
  const value = list.map((p) => {
    if (isRec(p) && "nl" in p && !("text" in p)) {
      const { nl, ...rest } = p;
      changed = true;
      return { text: nl, ...rest };
    }
    return p;
  });
  return { value, changed };
}

/** Insight caches used `examples[].nl` / `related[].nl`; they are now `text`. */
export function migrateInsightCache(cache: Rec): { value: Rec; changed: boolean } {
  let changed = false;
  const value: Rec = {};
  for (const [k, v] of Object.entries(cache)) {
    if (!isRec(v)) {
      value[k] = v;
      continue;
    }
    const ex = renamePairs(v.examples);
    const rel = renamePairs(v.related);
    if (ex.changed || rel.changed) changed = true;
    value[k] = { ...v, examples: ex.value, related: rel.value };
  }
  return { value, changed };
}

/** Description caches used `uitleg` / `grammatica[{woord, soort, details}]`; now `explanation` / `grammar[{word, kind, details}]`. */
export function migrateDescriptionCache(cache: Rec): { value: Rec; changed: boolean } {
  let changed = false;
  const value: Rec = {};
  for (const [k, v] of Object.entries(cache)) {
    if (!isRec(v) || !("uitleg" in v || "grammatica" in v)) {
      value[k] = v;
      continue;
    }
    changed = true;
    const { uitleg, grammatica, ...rest } = v;
    const out: Rec = { ...rest, explanation: "explanation" in v ? v.explanation : uitleg };
    const g = "grammar" in v ? v.grammar : grammatica;
    if (Array.isArray(g)) {
      out.grammar = g.map((row) => {
        if (!isRec(row) || !("woord" in row || "soort" in row)) return row;
        const { woord, soort, ...r } = row;
        return { word: woord, kind: soort, ...r };
      });
    }
    value[k] = out;
  }
  return { value, changed };
}
