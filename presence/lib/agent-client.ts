const AGENT_URL = 'http://127.0.0.1:4317';
const LOOPBACK_HOSTS = new Set(['localhost','127.0.0.1','[::1]']);

export function isTrustedLocalRequest(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  return LOOPBACK_HOSTS.has(url.hostname) && (!origin || origin === url.origin);
}

export function agentRequest(path: string, init?: RequestInit, timeoutMs = 310_000) {
  return fetch(`${AGENT_URL}${path}`, { ...init, signal:AbortSignal.timeout(timeoutMs) });
}
