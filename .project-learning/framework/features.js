import { tokenize } from './common.js';
export function lexicalFeatures(query,text){ const q=tokenize(query), t=new Set(tokenize(text)); return { overlap:q.filter(x=>t.has(x)).length, query_terms:q.length, document_terms:t.size }; }
