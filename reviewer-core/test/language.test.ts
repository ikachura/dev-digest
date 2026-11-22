/** Output-language check + one-shot repair (HW1 output-language policy). */
import { describe, it, expect } from 'vitest';
import type { LLMProvider, Review, StructuredResult } from '@devdigest/shared';
import { MockGitClient } from '../../server/src/adapters/mocks.js';
import { isOffLanguage, translateReviewProse } from '../src/review/language.js';
import { reviewPullRequest } from '../src/index.js';

function review(summary: string, title: string, rationale: string): Review {
  return {
    verdict: 'request_changes',
    summary,
    score: 50,
    findings: [
      {
        id: 'f1',
        severity: 'CRITICAL',
        category: 'security',
        title,
        file: 'src/config.ts',
        start_line: 11,
        end_line: 11,
        rationale,
        suggestion: null,
        confidence: 0.98,
        kind: 'finding',
      },
    ],
  } as Review;
}

const CHINESE = review(
  '发现两个严重的安全问题，必须在合并前修复。',
  '硬编码的密钥被提交到代码库',
  '文件包含两个硬编码的秘密：`EXPORT_SIGNING_SECRET` 和 `SEGMENT_WRITE_KEY`。这些密钥被实际使用。',
);
const ENGLISH = review(
  'Two critical exposures: a committed live Stripe key and an SSRF-shaped webhook forwarder.',
  'Hardcoded Stripe secret key in commit',
  'Line 12 contains a literal string starting with `sk_live_`, which appears to be a Stripe secret key.',
);

describe('isOffLanguage', () => {
  it('flags Chinese prose for an English target', () => {
    expect(isOffLanguage(CHINESE)).toBe(true);
  });
  it('accepts English prose, including code identifiers and paths', () => {
    expect(isOffLanguage(ENGLISH)).toBe(false);
    expect(isOffLanguage(review('Use `getTicketMetrics()` in `lib/a.ts`.', 'Rename x', 'See `a_b_c`.'))).toBe(false);
  });
  it('does not judge tiny samples (too few letters)', () => {
    expect(isOffLanguage(review('好', '坏', '错'))).toBe(false);
  });
  it('only English has a heuristic; other targets rely on the prompt rule', () => {
    expect(isOffLanguage(CHINESE, 'Ukrainian')).toBe(false);
  });
});

/** Provider: 1st call returns `first`; prose (repair) calls return `prose`. */
function provider(first: Review, prose?: unknown | Error) {
  const calls: string[] = [];
  const llm: LLMProvider = {
    id: 'openrouter',
    async completeStructured<T>(req): Promise<StructuredResult<T>> {
      calls.push(req.schemaName);
      if (req.schemaName === 'ReviewProse') {
        if (prose instanceof Error) throw prose;
        return { data: prose as T, model: req.model, tokensIn: 300, tokensOut: 100, costUsd: 0.0001, raw: '', attempts: 1 };
      }
      return { data: first as unknown as T, model: req.model, tokensIn: 50_000, tokensOut: 500, costUsd: 0.002, raw: '', attempts: 1 };
    },
    async listModels() { return []; },
    async complete() { throw new Error('not used'); },
    async embed() { return []; },
  };
  return { llm, calls };
}

const TRANSLATED = {
  summary: 'Two serious security issues must be fixed before merging.',
  findings: [{ id: 'f1', title: 'Hardcoded secret committed to the repo', rationale: 'The file contains two hardcoded secrets: `EXPORT_SIGNING_SECRET` and `SEGMENT_WRITE_KEY`.', suggestion: null }],
};

describe('translateReviewProse', () => {
  it('replaces only prose and keeps structure from the original', async () => {
    const tampered = { ...TRANSLATED, findings: [{ ...TRANSLATED.findings[0]!, id: 'f1' }] };
    const { llm } = provider(CHINESE, tampered);
    const fix = await translateReviewProse(CHINESE, { llm, model: 'm' });
    const f = fix.review.findings[0]!;
    expect(f.title).toBe('Hardcoded secret committed to the repo');
    expect([f.file, f.start_line, f.severity, f.category, f.id]).toEqual(['src/config.ts', 11, 'CRITICAL', 'security', 'f1']);
    expect(fix.review.verdict).toBe('request_changes');
    expect(fix.tokensIn).toBe(300);
  });
});

describe('reviewPullRequest — language check in the run loop', () => {
  const run = async (llm: LLMProvider) => {
    const events: string[] = [];
    const outcome = await reviewPullRequest({
      systemPrompt: 's', model: 'm', diff: await new MockGitClient().diff(), llm, onEvent: (e) => events.push(e.msg),
    });
    return { outcome, events };
  };

  it('English output → no extra call', async () => {
    const { llm, calls } = provider(ENGLISH);
    await run(llm);
    expect(calls).toEqual(['Review']);
  });

  it('Chinese output → one prose repair; result in English; tokens/cost include the repair', async () => {
    const { llm, calls } = provider(CHINESE, TRANSLATED);
    const { outcome, events } = await run(llm);
    expect(calls).toEqual(['Review', 'ReviewProse']);
    expect(outcome.review.findings[0]!.title).toBe('Hardcoded secret committed to the repo');
    expect(outcome.review.summary).toMatch(/^Two serious/);
    expect(outcome.tokensIn).toBe(50_300);
    expect(outcome.costUsd).toBeCloseTo(0.0021);
    expect(events.some((m) => /not in English — translating/.test(m))).toBe(true);
  });

  it('repair throws → original kept, run still succeeds', async () => {
    const { llm } = provider(CHINESE, new Error('upstream 500'));
    const { outcome, events } = await run(llm);
    expect(outcome.review.findings[0]!.title).toBe('硬编码的密钥被提交到代码库');
    expect(events.some((m) => /language repair failed/.test(m))).toBe(true);
  });

  it('repair still non-English → original kept with a warning', async () => {
    const { llm } = provider(CHINESE, { ...TRANSLATED, summary: '仍然是中文的摘要内容，模型没有按照要求把这段文字翻译成英文。', findings: [{ id: 'f1', title: '还是中文标题没有翻译', rationale: '还是中文的解释内容，没有被翻译成英文，所以应该保留原始结果并记录警告信息。', suggestion: null }] });
    const { outcome, events } = await run(llm);
    expect(outcome.review.findings[0]!.title).toBe('硬编码的密钥被提交到代码库');
    expect(events.some((m) => /still not in the target language/.test(m))).toBe(true);
  });
});
