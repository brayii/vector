export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_CHARS = 60_000;
export const MAX_ATTACHMENTS = 6;

export type ChatAttachment = {
  name: string;
  type: string;
  kind: 'image' | 'text' | 'unsupported';
  content?: string;
};

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'xml', 'html', 'css',
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go',
  'rs', 'rb', 'php', 'sql', 'yaml', 'yml', 'toml', 'ini', 'log', 'sh', 'ps1',
]);

export function attachmentKind(name: string, type: string): ChatAttachment['kind'] {
  if (type.startsWith('image/')) return 'image';
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (type.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) return 'text';
  return 'unsupported';
}

export function documentContext(attachments: ChatAttachment[]): string {
  if (!attachments.length) return '';
  return attachments.map((file) => {
    if (file.kind === 'text') return `\n\nAttached document: ${file.name}\n---\n${(file.content ?? '').slice(0, MAX_DOCUMENT_CHARS)}\n---`;
    if (file.kind === 'image') return `\n\nAttached image: ${file.name}. Inspect the supplied image pixels directly, including visible text.`;
    return `\n\nAttached file: ${file.name} (${file.type || 'unknown type'}). Its binary contents were not readable in this interface; say so if asked about its contents.`;
  }).join('');
}

