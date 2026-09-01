import test from 'node:test';
import assert from 'node:assert/strict';
import { HANGAR_REQUIREMENTS, HANGAR_REQUIREMENTS_SOURCE, hasCompleteHangarRequirementIndex } from '../lib/hangar-requirements.ts';

test('standalone puzzle context names the root README authority', () => {
  assert.equal(HANGAR_REQUIREMENTS_SOURCE, 'D:\\vector\\README.md');
  assert.match(HANGAR_REQUIREMENTS, /sole requirements authority/);
});

test('standalone puzzle context covers every README requirement identifier', () => {
  assert.equal(hasCompleteHangarRequirementIndex(), true);
  assert.match(HANGAR_REQUIREMENTS, /held-out unseen configurations/);
  assert.match(HANGAR_REQUIREMENTS, /never invent or hard-code a solution/i);
});
