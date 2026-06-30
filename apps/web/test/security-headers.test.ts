import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from '../src/lib/security-headers';

test('baseline security headers are present in development', () => {
  const h = buildSecurityHeaders({ isDev: true, isProd: false });
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  assert.equal(h['X-Frame-Options'], 'DENY');
  assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.ok(h['Permissions-Policy'].includes('microphone=()'));
  assert.ok(h['Content-Security-Policy'].length > 0);
  // Kein HSTS außerhalb von Produktion.
  assert.equal(h['Strict-Transport-Security'], undefined);
});

test('HSTS is set only in production', () => {
  const prod = buildSecurityHeaders({ isDev: false, isProd: true });
  assert.ok(prod['Strict-Transport-Security']?.includes('max-age='));
});

test('CSP locks down framing and objects, defaults to self', () => {
  const csp = buildContentSecurityPolicy(false);
  assert.ok(csp.includes("default-src 'self'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("base-uri 'self'"));
  assert.ok(csp.includes("form-action 'self'"));
});

test('CSP allows eval/websocket only in development', () => {
  assert.ok(buildContentSecurityPolicy(true).includes("'unsafe-eval'"));
  assert.ok(!buildContentSecurityPolicy(false).includes("'unsafe-eval'"));
  assert.ok(buildContentSecurityPolicy(true).includes('ws:'));
  assert.ok(!buildContentSecurityPolicy(false).includes('ws:'));
});
