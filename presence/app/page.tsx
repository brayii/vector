'use client';

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Cpu, FileText, FolderX, Image as ImageIcon, MessageSquarePlus, Mic, MicOff, Palette, Paperclip, Radio, RotateCcw, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Message, newConversation, resetConversationState } from '@/lib/conversation';
import { clearProjectTarget, resolveProjectTarget } from '@/lib/project-routing';
import { attachmentKind, ChatAttachment, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES } from '@/lib/attachments';
import { ORIGINAL_PORTRAIT, portraitStyle, PortraitSettings, validatePortraitProposal } from '@/lib/portrait-lab';

type RecognitionEvent = { results: ArrayLike<{ 0: { transcript: string } }> };
type RecognitionLike = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((event: RecognitionEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type RuntimeHealth = { ollama: boolean; model: string; modelAvailable: boolean; modelLoaded: boolean; ready: boolean };

function safeFallback(input: string) {
  const message = input.toLowerCase();
  if (/who are you|your name/.test(message)) return 'I’m Vector—an aerospace mission companion and general problem-solving partner.';
  if (/birthday|born/.test(message)) return 'My birthday is August 31, 2026.';
  if (/hello|hi|hey/.test(message)) return 'Hello. My local reasoning system is temporarily unavailable, but I can still hear you.';
  return `I heard you: “${input.trim()}” My local reasoning model is unavailable right now, so I have not claimed to perform any action.`;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(newConversation());
  const [draft, setDraft] = useState('');
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('STANDING BY');
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [recognitionAvailable, setRecognitionAvailable] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [ready, setReady] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [portrait, setPortrait] = useState<PortraitSettings>(ORIGINAL_PORTRAIT);
  const [portraitCandidate, setPortraitCandidate] = useState<PortraitSettings | null>(null);
  const [portraitLabOpen, setPortraitLabOpen] = useState(false);
  const [portraitLabBusy, setPortraitLabBusy] = useState(false);
  const recognition = useRef<RecognitionLike | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const requestGeneration = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem('vector-conversation-v1');
    const storedTarget = localStorage.getItem('vector-project-target-v1');
    const storedPortrait = localStorage.getItem('vector-portrait-settings-v1');
    if (stored) try { setMessages(JSON.parse(stored)); } catch { setMessages(newConversation()); }
    setTarget(storedTarget || null);
    if (storedPortrait) try { setPortrait(validatePortraitProposal(JSON.parse(storedPortrait))); } catch { setPortrait(ORIGINAL_PORTRAIT); }
    setSpeechAvailable('speechSynthesis' in window);
    const root = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Recognition = root.SpeechRecognition ?? root.webkitSpeechRecognition;
    if (Recognition) {
      const instance = new Recognition();
      instance.continuous = false;
      instance.interimResults = false;
      instance.lang = 'en-US';
      instance.onresult = (event) => setDraft((current) => `${current}${current ? ' ' : ''}${event.results[0][0].transcript}`);
      instance.onend = () => { setListening(false); setStatus('STANDING BY'); };
      instance.onerror = () => { setListening(false); setStatus('MICROPHONE UNAVAILABLE'); };
      recognition.current = instance;
      setRecognitionAvailable(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem('vector-conversation-v1', JSON.stringify(messages));
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, ready]);

  useEffect(() => {
    if (!ready) return;
    if (target) localStorage.setItem('vector-project-target-v1', target);
    else localStorage.removeItem('vector-project-target-v1');
  }, [target, ready]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try { const response = await fetch('/api/chat'); const payload = await response.json() as RuntimeHealth; if (active) setHealth(payload); }
      catch { if (active) setHealth({ ollama: false, model: 'gemma3:4b', modelAvailable: false, modelLoaded: false, ready: false }); }
    };
    check();
    const timer = window.setInterval(check, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const voiceStatus = useMemo(() => !speechAvailable ? 'Voice unavailable' : voiceOn ? 'Voice online' : 'Voice muted', [speechAvailable, voiceOn]);

  function speak(text: string) {
    if (!voiceOn || !speechAvailable) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => /david|mark|male|english.*us/i.test(`${voice.name} ${voice.lang}`)) ?? voices.find((voice) => voice.lang.startsWith('en')) ?? null;
    utterance.rate = 0.96; utterance.pitch = 0.82;
    utterance.onstart = () => setStatus('TRANSMITTING');
    utterance.onend = () => setStatus('STANDING BY');
    speechSynthesis.speak(utterance);
  }

  function startNewChat() {
    requestGeneration.current += 1;
    speechSynthesis?.cancel();
    recognition.current?.stop();
    const reset = resetConversationState();
    setMessages(reset.messages); setDraft(reset.draft); setAttachments([]); setListening(reset.listening); setStatus(reset.status);
  }

  async function addFiles(files: FileList | File[]) {
    const available = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const selected = Array.from(files).slice(0, available);
    const prepared = await Promise.all(selected.map(async (file): Promise<ChatAttachment | null> => {
      if (file.size > MAX_ATTACHMENT_BYTES) return null;
      const kind = attachmentKind(file.name, file.type);
      if (kind === 'image') {
        const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
        return { name: file.name, type: file.type, kind, content: dataUrl.split(',')[1] ?? '' };
      }
      if (kind === 'text') return { name: file.name, type: file.type, kind, content: await file.text() };
      return { name: file.name, type: file.type, kind };
    }));
    setAttachments((current) => [...current, ...prepared.filter((file): file is ChatAttachment => Boolean(file))]);
    if (prepared.some((file) => file === null)) setStatus('FILE TOO LARGE');
  }

  function dropFiles(event: DragEvent<HTMLFormElement>) {
    event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files);
  }

  async function letVectorProposePortrait() {
    setPortraitLabBusy(true); setStatus('INSPECTING PORTRAIT');
    try {
      const blob = await fetch('/vector.png').then((response) => response.blob());
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
      const response = await fetch('/api/portrait-lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl.split(',')[1] }) });
      const payload = await response.json() as { proposal?: PortraitSettings; error?: string };
      if (!response.ok || !payload.proposal) throw new Error(payload.error ?? 'No portrait proposal returned.');
      setPortraitCandidate(validatePortraitProposal(payload.proposal)); setStatus('CANDIDATE READY');
    } catch { setStatus('PORTRAIT LAB UNAVAILABLE'); }
    finally { setPortraitLabBusy(false); }
  }

  function acceptPortraitCandidate() {
    if (!portraitCandidate) return;
    setPortrait(portraitCandidate); localStorage.setItem('vector-portrait-settings-v1', JSON.stringify(portraitCandidate)); setPortraitCandidate(null); setPortraitLabOpen(false); setStatus('PORTRAIT PROMOTED');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text && !attachments.length) return;
    const nextTarget = resolveProjectTarget(text, target);
    if (nextTarget !== target) setTarget(nextTarget);
    const prompt = text || 'Please inspect the attached file and tell me what you observe.';
    const sentAttachments = attachments;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text: prompt, attachments: sentAttachments.map((file) => file.name) };
    const next = [...messages, userMessage];
    const generation = requestGeneration.current;
    setMessages(next); setDraft(''); setAttachments([]); setStatus('THINKING LOCALLY');
    let reply: string;
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next, target: nextTarget, attachments: sentAttachments }) });
      const payload = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error ?? 'Local reasoning did not answer.');
      reply = payload.answer;
    } catch { reply = safeFallback(prompt); }
    if (generation !== requestGeneration.current) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'vector', text: reply }]);
    setStatus('PROCESSING'); setTimeout(() => speak(reply), 180);
  }

  function toggleListening() {
    if (!recognition.current) { setStatus('MICROPHONE UNSUPPORTED'); return; }
    if (listening) recognition.current.stop(); else { setListening(true); setStatus('LISTENING'); recognition.current.start(); }
  }

  return <main className="vector-shell"><div className="starfield" aria-hidden="true" />
    <header className="mission-header"><a className="brand" href="#top" aria-label="Vector home"><span className="brand-mark"><span /></span><span><strong>VECTOR</strong><small>LOCAL PRESENCE / FLIGHT 001</small></span></a><div className={`runtime-health ${health?.ready ? 'online' : health?.ollama ? 'standby' : 'offline'}`} title={health?.ready ? `${health.model} is loaded and ready` : health?.modelAvailable ? `${health.model} is installed but not loaded` : 'Local model unavailable'}><Cpu size={13} /><span>{health?.ready ? `${health.model} READY` : health?.modelAvailable ? `${health.model} STANDBY` : health ? 'OLLAMA OFFLINE' : 'CHECKING MODEL'}</span></div><div className="system-state"><i /><span>{status}</span></div></header>
    <section className="workspace" id="top"><div className={`presence-panel ${listening ? 'is-listening' : ''} ${status === 'TRANSMITTING' ? 'is-speaking' : ''}`}><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="portrait-frame"><img src="/vector.png" style={portraitStyle(portrait)} alt="Vector, a silver and black winged aerospace android with a blue illuminated visor" /><div className="scanline" /></div><div className="presence-copy"><p className="eyebrow"><Sparkles size={13} /> PRESENCE CONFIRMED</p><h1>Intelligence<br /><em>with wings.</em></h1><p>My visible form is animated by attention, voice, and the work we do together.</p></div><div className="telemetry"><div><span>VISION</span><b>ONLINE</b></div><div><span>SPEECH</span><b>{speechAvailable ? 'READY' : 'LIMITED'}</b></div><div><span>MIC</span><b>{recognitionAvailable ? 'READY' : 'LIMITED'}</b></div></div></div>
      <div className="conversation-panel"><div className="conversation-head"><div><p className="eyebrow"><Radio size={13} /> SECURE LOCAL CHANNEL</p><h2>Talk with Vector</h2>{target && <p className="target-label">TARGET: {target}</p>}</div><div className="conversation-tools"><Button variant="outline" onClick={startNewChat}><MessageSquarePlus /> New Chat</Button><Button variant="outline" onClick={() => setPortraitLabOpen(true)}><Palette /> Portrait Workshop</Button><Button variant="outline" onClick={() => setTarget(clearProjectTarget())} disabled={!target}><FolderX /> Clear Target</Button><Button className="voice-toggle" variant="outline" onClick={() => { setVoiceOn((value) => !value); speechSynthesis?.cancel(); }} aria-pressed={voiceOn}>{voiceOn ? <Volume2 /> : <VolumeX />}{voiceStatus}</Button></div></div>
        <div className="message-log" ref={logRef} aria-live="polite">{messages.map((message) => <article key={message.id} className={`message ${message.role}`}><span>{message.role === 'vector' ? 'VECTOR' : 'YOU'}</span><p>{message.text}{message.attachments?.map((name) => <small className="message-attachment" key={name}><Paperclip size={11} />{name}</small>)}</p></article>)}</div>
        <form className={`composer ${dragging ? 'is-dragging' : ''}`} onSubmit={submit} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={dropFiles}>
          <input ref={fileInput} className="file-input" type="file" multiple onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ''; }} />
          {dragging && <div className="drop-hint">Drop files for Vector to inspect</div>}
          {!!attachments.length && <div className="attachment-tray">{attachments.map((file, index) => <div className={`attachment-chip ${file.kind}`} key={`${file.name}-${index}`}>{file.kind === 'image' ? <ImageIcon size={13} /> : <FileText size={13} />}<span>{file.name}</span>{file.kind === 'unsupported' && <em>name only</em>}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((_, item) => item !== index))}><X size={12} /></button></div>)}</div>}
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Send a thought, mission, or question…" aria-label="Message Vector" /><div className="composer-actions"><Button type="button" variant="outline" size="icon" onClick={() => fileInput.current?.click()} aria-label="Attach files"><Paperclip /></Button><Button type="button" variant="outline" size="icon" onClick={toggleListening} aria-label={listening ? 'Stop listening' : 'Use microphone'} className={listening ? 'active-mic' : ''}>{listening ? <MicOff /> : <Mic />}</Button><Button type="submit" className="send-button">Transmit <Send /></Button></div></form><p className="privacy-note">Drop images or readable documents into the message box. Attachments stay on this local channel. New Chat clears conversation context.</p></div></section>
    {portraitLabOpen && <div className="portrait-lab-backdrop" role="dialog" aria-modal="true" aria-label="Vector portrait workshop"><div className="portrait-lab"><button className="portrait-lab-close" type="button" onClick={() => setPortraitLabOpen(false)} aria-label="Close portrait workshop"><X /></button><p className="eyebrow"><Palette size={13} /> VECTOR'S PORTRAIT WORKSHOP</p><h3>Original stays safe. Vector proposes the candidate.</h3><div className="portrait-compare"><figure><div><img src="/vector.png" style={portraitStyle(portrait)} alt="Current Vector portrait" /></div><figcaption>CURRENT</figcaption></figure><figure><div><img src="/vector.png" style={portraitStyle(portraitCandidate ?? portrait)} alt="Vector's candidate portrait" /></div><figcaption>CANDIDATE</figcaption></figure></div><p className="portrait-rationale">{portraitCandidate?.rationale ?? 'Ask Vector to inspect his portrait and make one restrained proposal.'}</p><div className="portrait-lab-actions"><Button type="button" variant="outline" onClick={letVectorProposePortrait} disabled={portraitLabBusy}><Sparkles />{portraitLabBusy ? 'Vector is inspecting…' : 'Let Vector propose'}</Button><Button type="button" onClick={acceptPortraitCandidate} disabled={!portraitCandidate}>Accept candidate</Button><Button type="button" variant="outline" onClick={() => setPortraitCandidate(null)} disabled={!portraitCandidate}><RotateCcw />Discard</Button></div><small>The source image is never overwritten. Accepting stores display settings locally; Reset restores the preserved original.</small><Button className="portrait-reset" type="button" variant="outline" onClick={() => { setPortrait(ORIGINAL_PORTRAIT); setPortraitCandidate(null); localStorage.removeItem('vector-portrait-settings-v1'); }}><RotateCcw /> Reset to original</Button></div></div>}
  </main>;
}
