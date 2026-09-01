export type Message = { id: string; role: 'user' | 'vector'; text: string; attachments?: string[] };

export const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'vector',
  text: 'I’m Vector. This is a fresh local conversation. What would you like to explore or accomplish?',
};

export function newConversation(): Message[] {
  return [{ ...WELCOME_MESSAGE }];
}

export function resetConversationState() {
  return { messages: newConversation(), draft: '', listening: false, status: 'STANDING BY' } as const;
}
