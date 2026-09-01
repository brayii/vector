import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { ensureDb } from '../framework/common.js'; import { lexicalFeatures } from '../framework/features.js'; import { rankingMetrics } from '../framework/evaluate.js'; import { retrieve } from '../framework/retrieve.js';
test('database creation and schema migration',()=>{ const dir=fs.mkdtempSync(path.join(os.tmpdir(),'learning-')); const p=path.join(dir,'test.db'); const conn=ensureDb(p); assert.equal(conn.prepare('SELECT MAX(version) v FROM schema_migrations').get().v,1); conn.close(); });
test('lexical features are deterministic',()=>{ assert.deepEqual(lexicalFeatures('happy birthday','birthday card'),{overlap:1,query_terms:2,document_terms:2}); });
test('ranking metrics calculate reciprocal rank',()=>{ assert.equal(rankingMetrics([0,1,0]).mrr,0.5); });
test('context packet has required shape',()=>{ const p=retrieve('happy birthday',false); assert.equal(p.task,'happy birthday'); assert.ok(Array.isArray(p.relevant_memory)); assert.equal(p.retriever_versions.context,'lexical-v1'); });
