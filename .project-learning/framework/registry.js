import path from 'node:path'; import { ROOT, readJson, writeJsonAtomic } from './common.js';
const registryPath=()=>path.join(ROOT,'models','registry.json');
export function registry(){ return readJson(registryPath(),{version:1,objectives:{}}); }
export function rollback(objective='context_retrieval'){ const r=registry(); const o=r.objectives[objective]; if(!o?.rollback_target) return {changed:false,reason:'No rollback target'}; [o.champion,o.rollback_target]=[o.rollback_target,o.champion]; writeJsonAtomic(registryPath(),r); return {changed:true,champion:o.champion}; }
