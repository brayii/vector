export function explicitProjectPath(message: string): string | null {
  const quoted = message.match(/["']([A-Za-z]:\\[^"']+)["']/)?.[1];
  const unquoted = message.match(/\b[A-Za-z]:\\[^\s"'<>|?*]+/)?.[0];
  return (quoted ?? unquoted ?? '').replace(/[.,;:!?]+$/, '') || null;
}

export function resolveProjectTarget(message: string, current: string | null): string | null {
  return explicitProjectPath(message) ?? current;
}

export function clearProjectTarget(): null {
  return null;
}
