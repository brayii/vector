import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { ROOT, ensureDb, now, writeJsonAtomic } from './common.js';
export function buildDataset(objective='context_retrieval') {
  const conn=ensureDb(); const rows=conn.prepare("SELECT task_id,timestamp,request_text,task_type FROM tasks WHERE status='completed' ORDER BY timestamp,task_id").all(); conn.close();
  const datasetId=`${objective}-${crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0,12)}`;
  const cut=Math.max(1,Math.floor(rows.length*0.8)); const value={dataset_id:datasetId,created_at:now(),objective,included_task_ids:rows.map(x=>x.task_id),label_rules:'verified structured evidence',feature_rules:'lexical-v1',split_strategy:'chronological-80-20',random_seed:0,duplicate_policy:'exact request deduplication',train:rows.slice(0,cut),test:rows.slice(cut)};
  writeJsonAtomic(path.join(ROOT,'data','exports',`${datasetId}.json`),value); return value;
}
