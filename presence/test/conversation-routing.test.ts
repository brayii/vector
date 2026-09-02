import test from 'node:test';
import assert from 'node:assert/strict';
import { newConversation, resetConversationState } from '../lib/conversation.ts';
import { clearProjectTarget, explicitProjectPath, resolveProjectTarget } from '../lib/project-routing.ts';

test('new conversation removes prior context and restores one welcome message', () => {
  const prior = [...newConversation(), { id: 'u1', role: 'user' as const, text: 'old context' }];
  const reset = resetConversationState();
  assert.equal(prior.length, 2);
  assert.equal(reset.messages.length, 1);
  assert.equal(reset.messages[0].id, 'welcome');
  assert.equal(reset.draft, '');
});

test('project routing selects Windows and POSIX paths and preserves scope for follow-ups', () => {
  assert.equal(explicitProjectPath('work in D:\\AI_bunny_sim'), 'D:\\AI_bunny_sim');
  assert.equal(explicitProjectPath('use "D:\\My Project" now'), 'D:\\My Project');
  assert.equal(explicitProjectPath('work in /home/angel/vector'), '/home/angel/vector');
  assert.equal(explicitProjectPath('use "/home/angel/My Project" now'), '/home/angel/My Project');
  assert.equal(explicitProjectPath('work in ~/vector'), '~/vector');
  assert.equal(resolveProjectTarget('continue', 'D:\\vector'), 'D:\\vector');
  assert.equal(resolveProjectTarget('continue', '/home/angel/vector'), '/home/angel/vector');
});

test('clear project target returns neutral scope', () => {
  assert.equal(clearProjectTarget(), null);
});
