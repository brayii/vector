#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
import { ROOT, ensureDb, now, readJson, writeJsonAtomic } from './common.js'; import { bootstrap } from './bootstrap.js'; import { retrieve } from './retrieve.js'; import { startTask, finishTask } from './collect.js'; import { buildDataset } from './dataset.js'; import { train } from './train.js'; import { evaluate } from './evaluate.js'; import { registry, rollback } from './registry.js';

export function status(){ const conn=ensureDb(); const completed=conn.prepare("SELECT COUNT(*) n FROM tasks WHERE status='completed'").get().n; const started=conn.prepare("SELECT COUNT(*) n FROM tasks WHERE status='started'").get().n; conn.close(); const config=readJson(path.join(ROOT,'config.json')); const reg=registry(); const s={framework_initialized:true,schema_version:config.schema_version,total_completed_tasks:completed,total_usable_training_examples:completed,active_objectives:['context_retrieval'],current_champions:Object.fromEntries(Object.entries(reg.objectives||{}).map(([k,v])=>[k,v.champion])),last_training_time:null,last_evaluation_time:null,next_lifecycle_threshold:Math.max(0,config.lifecycle.reevaluate_every_new_tasks-completed),pending_lifecycle_work:started?`${started} task(s) in progress`:'none',drift_monitoring_status:'baseline; insufficient history',known_limitations:['Node.js implementation because Python is unavailable','Insufficient task history for learned challengers']}; const md=`# Project Learning Status\n\n- Framework initialized: yes\n- Schema version: ${s.schema_version}\n- Completed tasks: ${completed}\n- Usable training examples: ${completed}\n- Active objectives: context retrieval\n- Current champion: ${s.current_champions.context_retrieval}\n- Next lifecycle threshold: ${s.next_lifecycle_threshold} task(s)\n- Pending work: ${s.pending_lifecycle_work}\n- Drift monitoring: ${s.drift_monitoring_status}\n- Known limitations: ${s.known_limitations.join('; ')}\n`; fs.writeFileSync(path.join(ROOT,'STATUS.md'),md); writeJsonAtomic(path.join(ROOT,'state.json'),{...s,updated_at:now()}); return s; }
export function lifecycleCheck(){ const s=status(); return {eligible:s.total_completed_tasks>=10,action:s.total_completed_tasks>=10?'evaluate':'retain-baseline',status:s}; }

const [op='status',...args]=process.argv.slice(2); let result;
if(op==='bootstrap') result=bootstrap();
else if(op==='pre-task'){ const request=args.join(' '); result={...startTask(request),context:retrieve(request)}; }
else if(op==='post-task'){ const [taskId,...rest]=args; finishTask(taskId,{result:rest.join(' ')||'completed',verification:'lifecycle post-task',success:true}); result=lifecycleCheck(); }
else if(op==='retrieve') result=retrieve(args.join(' '));
else if(op==='dataset') result=buildDataset(args[0]);
else if(op==='train') result=train(args[0]);
else if(op==='evaluate') result=evaluate(train(args[0]));
else if(op==='rollback') result=rollback(args[0]);
else if(op==='status') result=status();
else throw new Error(`Unknown operation: ${op}`);
console.log(JSON.stringify(result,null,2));
