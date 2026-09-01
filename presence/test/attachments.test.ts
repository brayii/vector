import test from 'node:test';
import assert from 'node:assert/strict';
import { attachmentKind, documentContext } from '../lib/attachments.ts';

test('classifies image and readable document attachments', () => {
  assert.equal(attachmentKind('vector.png', 'image/png'), 'image');
  assert.equal(attachmentKind('notes.md', ''), 'text');
  assert.equal(attachmentKind('data.csv', 'application/octet-stream'), 'text');
  assert.equal(attachmentKind('manual.pdf', 'application/pdf'), 'unsupported');
});

test('builds honest model context for readable and unsupported files', () => {
  const context = documentContext([
    { name: 'note.txt', type: 'text/plain', kind: 'text', content: 'hello Vector' },
    { name: 'manual.pdf', type: 'application/pdf', kind: 'unsupported' },
  ]);
  assert.match(context, /hello Vector/);
  assert.match(context, /binary contents were not readable/);
});
