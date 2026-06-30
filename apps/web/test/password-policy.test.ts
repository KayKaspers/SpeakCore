import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPasswordPair,
  checkPasswordStrength,
  isPlausibleEmail,
} from '../src/core/password-policy';

test('checkPasswordStrength: accepts a strong password', () => {
  const r = checkPasswordStrength('Sup3rSecret!Pass');
  assert.equal(r.valid, true);
  assert.deepEqual(r.failed, []);
});

test('checkPasswordStrength: reports each violated rule', () => {
  assert.deepEqual(checkPasswordStrength('short').failed.includes('minLength'), true);
  assert.deepEqual(checkPasswordStrength('alllowercase123').failed.includes('uppercase'), true);
  assert.deepEqual(checkPasswordStrength('ALLUPPERCASE123').failed.includes('lowercase'), true);
  assert.deepEqual(checkPasswordStrength('NoDigitsHereXX').failed.includes('digit'), true);
});

test('checkPasswordPair: detects mismatch', () => {
  const r = checkPasswordPair('Sup3rSecret!Pass', 'Different1Pass!');
  assert.equal(r.mismatch, true);
  assert.equal(r.valid, false);
});

test('checkPasswordPair: valid when strong and matching', () => {
  const r = checkPasswordPair('Sup3rSecret!Pass', 'Sup3rSecret!Pass');
  assert.equal(r.mismatch, false);
  assert.equal(r.valid, true);
});

test('isPlausibleEmail', () => {
  assert.equal(isPlausibleEmail('owner@example.com'), true);
  assert.equal(isPlausibleEmail('not-an-email'), false);
  assert.equal(isPlausibleEmail('missing@domain'), false);
});
