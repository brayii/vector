import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrustedLocalRequest } from '../lib/agent-client.ts';

test('local agent proxy accepts loopback same-origin requests', () => {
  assert.equal(isTrustedLocalRequest(new Request('http://localhost:3000/api/chat',{headers:{origin:'http://localhost:3000'}})),true);
  assert.equal(isTrustedLocalRequest(new Request('http://127.0.0.1:3000/api/chat',{headers:{origin:'http://127.0.0.1:3000'}})),true);
});

test('local agent proxy rejects cross-origin and non-loopback requests', () => {
  assert.equal(isTrustedLocalRequest(new Request('http://localhost:3000/api/chat',{headers:{origin:'https://evil.invalid'}})),false);
  assert.equal(isTrustedLocalRequest(new Request('http://evil.invalid:3000/api/chat')),false);
});
