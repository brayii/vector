import { validatePortraitProposal } from '@/lib/portrait-lab';
import { agentRequest, isTrustedLocalRequest } from '@/lib/agent-client';

export async function POST(request: Request) {
  try {
    if (!isTrustedLocalRequest(request)) return Response.json({ error:'Cross-origin access to Vector’s portrait tools is not allowed.' }, { status:403 });
    const body = await request.json() as { image?: string };
    if (!body.image || body.image.length > 12_000_000) return Response.json({ error:'A portrait image is required.' }, { status:400 });
    const response = await agentRequest('/portrait', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) }, 130_000);
    const payload = await response.json() as { raw?: string; model?: string; error?: string };
    if (!response.ok) return Response.json({ error:payload.error || 'Portrait model unavailable.' }, { status:response.status });
    const parsed = JSON.parse((payload.raw || '{}').match(/\{[\s\S]*\}/)?.[0] || '{}');
    return Response.json({ proposal:validatePortraitProposal(parsed), model:payload.model });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : 'Portrait workshop unavailable.' }, { status:503 });
  }
}
