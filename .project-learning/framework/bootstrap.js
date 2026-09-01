import fs from 'node:fs';
import path from 'node:path';
import { ROOT, REPO, ensureDb, now, revision, writeJsonAtomic } from './common.js';

export function bootstrap() {
  for (const dir of ['data/exports','models/champion','models/challengers','evals/results','experiments/results','memory','runtime']) fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  const conn = ensureDb();
  const repoFiles = fs.readdirSync(REPO, { withFileTypes: true }).filter(x => x.isFile()).map(x => x.name).filter(x => !x.toLowerCase().includes('secret'));
  const stamp = now();
  const rev = revision();
  const existing = conn.prepare("SELECT chunk_id FROM memory_chunks WHERE chunk_id='initial_repository'").get();
  if (!existing) conn.prepare('INSERT INTO memory_chunks(chunk_id,source,topic,content,active,confidence,evidence_revision,valid_from_revision,last_verified_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('initial_repository','bootstrap','repository','Initial repository files: '+repoFiles.join(', '),1,1,rev,rev,rev,stamp,stamp);
  conn.close();
  writeJsonAtomic(path.join(ROOT,'models','registry.json'), { version: 1, objectives: { context_retrieval: { baseline: 'lexical-v1', champion: 'lexical-v1', challengers: [], rollback_target: null } } });
  if (!fs.existsSync(path.join(ROOT,'experiments','registry.jsonl'))) fs.writeFileSync(path.join(ROOT,'experiments','registry.jsonl'), '');
  if (!fs.existsSync(path.join(ROOT,'evals','definitions.json'))) writeJsonAtomic(path.join(ROOT,'evals','definitions.json'), { version: 1, objectives: { context_retrieval: ['recall@5','mrr','ndcg@5'] } });
  return { initialized: true, repository_revision: rev, files: repoFiles.length };
}
