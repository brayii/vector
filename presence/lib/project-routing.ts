export function explicitProjectPath(message: string): string | null {
  const quoted = message.match(/["']((?:[A-Za-z]:\\|\/|~\/)[^"']+)["']/)?.[1];
  const windows = message.match(/\b[A-Za-z]:\\[^\s"'<>|?*]+/)?.[0];
  const posix = message.match(/(?:^|\s)((?:\/|~\/)[^\s"'<>|?*]+)/)?.[1];
  return (quoted ?? windows ?? posix ?? '').replace(/[.,;:!?]+$/, '') || null;
}

export function resolveProjectTarget(message: string, current: string | null): string | null {
  return explicitProjectPath(message) ?? current;
}

export function clearProjectTarget(): null {
  return null;
}
