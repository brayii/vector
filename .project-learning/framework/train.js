import fs from 'node:fs'; import path from 'node:path';
import { ROOT, now, writeJsonAtomic } from './common.js'; import { buildDataset } from './dataset.js';
export function train(objective='context_retrieval'){ const dataset=buildDataset(objective); const model={model_id:`lexical-${dataset.dataset_id}`,objective,type:'deterministic-lexical',dataset_id:dataset.dataset_id,created_at:now(),status:'challenger'}; const p=path.join(ROOT,'models','challengers',`${model.model_id}.json`); writeJsonAtomic(p,model); return {...model,artifact_path:p}; }
