import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPeerContext } from '../lib/peer-knowledge.ts';

test('peer context requires a public summary and provenance', () => {
  const context = publicPeerContext({ version: 1, peers: [
    { name: 'Falih', public_summary: 'A verified project peer.', provenance: { source: 'verified framework' }, private_transcript: 'must not leak' },
    { name: 'Unverified', public_summary: 'No source' },
  ] });
  assert.match(context, /Falih: A verified project peer/);
  assert.match(context, /public, provenance-marked/);
  assert.doesNotMatch(context, /private_transcript|must not leak|Unverified/);
});

test('invalid peer stores fail closed', () => {
  assert.equal(publicPeerContext({ version: 2, peers: [] }), '');
  assert.equal(publicPeerContext({ version: 1, peers: 'not-an-array' }), '');
});
