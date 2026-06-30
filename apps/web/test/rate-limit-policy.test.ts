import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRateLimit, type RateLimitConfig } from '../src/core/rate-limit-policy';

const cfg: RateLimitConfig = { windowMs: 1000, max: 3 };
const NOW = 10_000;

test('not limited when there are no hits', () => {
  const r = evaluateRateLimit([], NOW, cfg);
  assert.equal(r.limited, false);
  assert.equal(r.remaining, 3);
  assert.equal(r.retryAfterMs, 0);
});

test('not limited below the max', () => {
  const r = evaluateRateLimit([NOW - 100, NOW - 200], NOW, cfg);
  assert.equal(r.limited, false);
  assert.equal(r.remaining, 1);
});

test('limited when hits reach the max', () => {
  const r = evaluateRateLimit([NOW - 100, NOW - 200, NOW - 300], NOW, cfg);
  assert.equal(r.limited, true);
  assert.equal(r.remaining, 0);
  // retryAfter = oldest(NOW-300) + window(1000) - NOW = 700
  assert.equal(r.retryAfterMs, 700);
});

test('hits outside the window are ignored', () => {
  const r = evaluateRateLimit([NOW - 2000, NOW - 1500, NOW - 1200], NOW, cfg);
  assert.equal(r.limited, false);
  assert.equal(r.remaining, 3);
});
