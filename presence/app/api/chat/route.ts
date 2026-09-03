import { agentRequest, isTrustedLocalRequest } from '@/lib/agent-client';

export async function POST(request: Request) {
  try {
    if (!isTrustedLocalRequest(request)) return Response.json({ error:'Cross-origin access to Vector’s local agent is not allowed.', activity:[] }, { status:403 });
    const body = await request.text();
    const response = await agentRequest('/agent', { method:'POST', headers:{ 'Content-Type':'application/json' }, body });
    return new Response(await response.text(), { status:response.status, headers:{ 'Content-Type':'application/json', 'Cache-Control':'no-store' } });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? `The local agent backend is unavailable: ${error.message}` : 'The local agent backend is unavailable.', activity:[] }, { status:503 });
  }
}

export async function GET() {
  try {
    const response = await agentRequest('/health');
    return new Response(await response.text(), { status:response.status, headers:{ 'Content-Type':'application/json', 'Cache-Control':'no-store' } });
  } catch {
    return Response.json({ ollama:false, model:'unavailable', modelAvailable:false, modelLoaded:false, ready:false, state:'agent_unavailable' }, { status:503 });
  }
}
