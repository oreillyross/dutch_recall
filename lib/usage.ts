export type Usage = { model: string; inputTokens: number; outputTokens: number; costUSD: number | null };

export type UsageTotals = {
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  /** calls whose model had no known price, so cost is a lower bound */
  unpriced: number;
  byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUSD: number }>;
  since: string;
};

export const emptyUsage = (): UsageTotals => ({
  calls: 0,
  errors: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUSD: 0,
  unpriced: 0,
  byModel: {},
  since: new Date().toISOString(),
});

export function recordCall(t: UsageTotals, u: Usage): UsageTotals {
  const m = t.byModel[u.model] ?? { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 };
  return {
    ...t,
    calls: t.calls + 1,
    inputTokens: t.inputTokens + u.inputTokens,
    outputTokens: t.outputTokens + u.outputTokens,
    costUSD: t.costUSD + (u.costUSD ?? 0),
    unpriced: t.unpriced + (u.costUSD == null ? 1 : 0),
    byModel: {
      ...t.byModel,
      [u.model]: {
        calls: m.calls + 1,
        inputTokens: m.inputTokens + u.inputTokens,
        outputTokens: m.outputTokens + u.outputTokens,
        costUSD: m.costUSD + (u.costUSD ?? 0),
      },
    },
  };
}

export const recordError = (t: UsageTotals): UsageTotals => ({ ...t, errors: t.errors + 1 });
