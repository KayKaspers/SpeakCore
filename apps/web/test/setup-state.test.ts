import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSetupLocked, normalizeSystemMode, resolveSetupState } from '../src/core/setup-state';

test('resolveSetupState: no user, unlocked → needs-setup', () => {
  assert.equal(resolveSetupState(0, false), 'needs-setup');
});

test('resolveSetupState: no user, locked → locked', () => {
  assert.equal(resolveSetupState(0, true), 'locked');
});

test('resolveSetupState: user exists → completed (even if locked)', () => {
  assert.equal(resolveSetupState(1, false), 'completed');
  assert.equal(resolveSetupState(3, true), 'completed');
});

test('isSetupLocked: parses common truthy values', () => {
  for (const v of ['1', 'true', 'TRUE', 'yes']) assert.equal(isSetupLocked(v), true);
  for (const v of [undefined, '', 'false', '0', 'no']) assert.equal(isSetupLocked(v), false);
});

test('normalizeSystemMode: only "expert" maps to expert', () => {
  assert.equal(normalizeSystemMode('expert'), 'expert');
  assert.equal(normalizeSystemMode('simple'), 'simple');
  assert.equal(normalizeSystemMode('anything'), 'simple');
});
