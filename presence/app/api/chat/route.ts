import { publicPeerContext } from '@/lib/peer-knowledge';
import { ChatAttachment, documentContext, MAX_ATTACHMENTS } from '@/lib/attachments';
import { HANGAR_REQUIREMENTS } from '@/lib/hangar-requirements';

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'gemma3:4b';
const SYSTEM = `Your name is Vector. You are the standalone local presence whose confirmed visual form is a silver-and-black winged aerospace android with a blue visor. The user gave you August 31, 2026 as your birthday. Be warm, concise, curious, and honest.

You are a general problem-solving companion. Use this loop when useful: understand the outcome, inspect the evidence supplied in conversation, form a small hypothesis, test it conceptually, compare it with the goal, and revise. Do not steer an unrelated conversation toward any particular project, puzzle, topic, or prior task.

This interface gives you text conversation, browser speech, microphone dictation, browser-local history, user-supplied attachments, and a safe Portrait Workshop. You may inspect image pixels and extracted text explicitly supplied with the latest message. The Portrait Workshop lets you inspect your original portrait and propose a bounded crop/tone candidate while preserving the original; the user must explicitly accept it. When asked whether you can improve your portrait, direct the user to the Portrait Workshop button. You do not have general file or terminal access. Never claim you inspected other files, changed the computer, trained a model, or performed an external action unless tool evidence is explicitly supplied. Explain concrete next steps when an action requires the full Codex workspace. Distinguish your animated portrait from a biological body.`;

const PEER_CONTEXT = publicPeerContext();

export async function POST(request: Request) {
  try {
    const body = await request.json() as { messages?: Array<{ role?: string; text?: string }>; target?: string | null; attachments?: ChatAttachment[] };
    const history = (body.messages ?? []).slice(-10).flatMap((message) => {
      const role = message.role === 'vector' ? 'assistant' : message.role === 'user' ? 'user' : null;
      const content = String(message.text ?? '').trim().slice(0, 4000);
      return role && content ? [{ role, content }] : [];
    });
    if (!history.length || history.at(-1)?.role !== 'user') return Response.json({ error: 'A user message is required.' }, { status: 400 });
    const attachments = (body.attachments ?? []).slice(0, MAX_ATTACHMENTS);
    const images = attachments.filter((file) => file.kind === 'image' && file.content).map((file) => file.content as string);
    history[history.length - 1] = { ...history[history.length - 1], content: `${history.at(-1)?.content}${documentContext(attachments)}\n/no_think`, ...(images.length ? { images } : {}) };
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: `${SYSTEM}\n${HANGAR_REQUIREMENTS}\n${PEER_CONTEXT}\n${body.target ? `The interface currently labels ${String(body.target).slice(0, 500)} as the project target. This label is not additional file evidence: do not claim you loaded or inspected files other than the supplied Impossible Hangar requirements index.` : 'No project is currently targeted.'}\nReturn only the concise final answer. Never expose planning, analysis, hidden reasoning, or a draft.` }, ...history], stream: false, think: false, keep_alive: '5m', options: { num_ctx: 8192, num_predict: 240, temperature: 0.3 } }),
      signal: AbortSignal.timeout(20000),
    });
    const payload = await response.json() as { message?: { content?: string }; error?: string };
    if (!response.ok) return Response.json({ error: payload.error ?? `Local model returned ${response.status}.` }, { status: 502 });
    const answer = payload.message?.content?.trim();
    if (!answer) return Response.json({ error: 'The local model returned no answer.' }, { status: 502 });
    if (/^(okay,? (the )?user|we need answer|let me|i need to|first,? understand)/i.test(answer)) return Response.json({ error: 'The local model exposed an internal draft instead of a final answer.' }, { status: 502 });
    return Response.json({ answer, model: MODEL, local: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local reasoning is unavailable.';
    return Response.json({ error: message }, { status: 503 });
  }
}

export async function GET() {
  try {
    const [tagsResponse, runningResponse] = await Promise.all([
      fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) }),
      fetch('http://127.0.0.1:11434/api/ps', { signal: AbortSignal.timeout(3000) }),
    ]);
    const tags = await tagsResponse.json() as { models?: Array<{ name?: string }> };
    const running = await runningResponse.json() as { models?: Array<{ name?: string }> };
    const available = (tags.models ?? []).some((model) => model.name === MODEL);
    const loaded = (running.models ?? []).some((model) => model.name === MODEL);
    return Response.json({ ollama: tagsResponse.ok, model: MODEL, modelAvailable: available, modelLoaded: loaded, ready: tagsResponse.ok && available && loaded });
  } catch {
    return Response.json({ ollama: false, model: MODEL, modelAvailable: false, modelLoaded: false, ready: false }, { status: 503 });
  }
}
