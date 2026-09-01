import { validatePortraitProposal } from '@/lib/portrait-lab';
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'gemma3:4b';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { image?: string };
    if (!body.image || body.image.length > 12_000_000) return Response.json({ error: 'A portrait image is required.' }, { status: 400 });
    const response = await fetch(OLLAMA_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000), body: JSON.stringify({ model: MODEL, stream: false, think: false, format: 'json', keep_alive: '5m', messages: [{ role: 'user', images: [body.image], content: 'You are Vector using your own safe portrait workshop. Inspect this portrait and propose one restrained display cleanup that centers the winged android and reduces visible logos, captions, or distracting edges through crop/position and basic tonal settings only. The original must remain untouched. Return JSON only with scale (1 to 2.2), positionX (0 to 100), positionY (0 to 100), brightness (0.55 to 1.25), contrast (0.8 to 1.5), saturation (0.5 to 1.5), and rationale (one short sentence). Do not claim pixels were erased; this tool only reframes and adjusts tone.' }], options: { num_ctx: 4096, num_predict: 180, temperature: 0.2 } }) });
    const payload = await response.json() as { message?: { content?: string }; error?: string };
    if (!response.ok) return Response.json({ error: payload.error ?? 'Portrait model unavailable.' }, { status: 502 });
    const raw = payload.message?.content ?? '{}'; const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return Response.json({ proposal: validatePortraitProposal(parsed), model: MODEL });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Portrait workshop unavailable.' }, { status: 503 }); }
}
