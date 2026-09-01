import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDb, revision, tokenize, writeJsonAtomic } from './common.js';

export function retrieve(task, output = true) {
  const conn = ensureDb();
  const terms = tokenize(task);
  const score = (text) => { const tokens = tokenize(text); return terms.reduce((n,t) => n + (tokens.includes(t) ? 1 : 0), 0); };
  const memories = conn.prepare('SELECT chunk_id,topic,content,confidence FROM memory_chunks WHERE active=1').all().map(x => ({...x, score: score(`${x.topic} ${x.content}`)})).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0,5);
  const failures = conn.prepare("SELECT category,symptom,fix FROM failures WHERE status!='resolved' OR status IS NULL").all().map(x => ({...x, score: score(`${x.category} ${x.symptom}`)})).filter(x => x.score > 0).slice(0,5);
  const similar = conn.prepare("SELECT task_id,request_text,task_type FROM tasks WHERE status='completed'").all().map(x => ({...x, score: score(x.request_text)})).filter(x => x.score > 0).sort((a,b)=>b.score-a.score).slice(0,5);
  const packet = { task, repository_revision: revision(), relevant_memory: memories, likely_files: [], known_failures: failures, related_decisions: [], similar_tasks: similar, retriever_versions: { context: 'lexical-v1' }, confidence: { context: memories.length ? 'medium' : 'low' } };
  conn.close();
  if (output) writeJsonAtomic(path.join(ROOT,'runtime','context.json'), packet);
  return packet;
}
