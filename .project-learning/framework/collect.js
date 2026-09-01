import { ensureDb, id, now, revision } from './common.js';

export function startTask(request, type='general', runId=id('run')) {
  const conn=ensureDb(); const taskId=id('task');
  conn.prepare('INSERT INTO tasks(task_id,timestamp,request_text,task_type,status,repository_revision,lifecycle_run_id) VALUES(?,?,?,?,?,?,?)').run(taskId,now(),request,type,'started',revision(),runId); conn.close();
  return { task_id: taskId, lifecycle_run_id: runId };
}
export function finishTask(taskId, data={}) {
  const conn=ensureDb();
  conn.exec('BEGIN IMMEDIATE');
  try {
    for (const f of data.files || []) conn.prepare('INSERT OR REPLACE INTO task_files(task_id,file_path,relationship,inspected,modified,verified_relevant,discovery_source) VALUES(?,?,?,?,?,?,?)').run(taskId,f.path,f.relationship||'implementation',f.inspected?1:0,f.modified?1:0,f.relevant?1:0,f.source||'repository_search');
    for (const o of data.observations || []) conn.prepare('INSERT INTO observations(observation_id,task_id,category,content,evidence,confidence,timestamp) VALUES(?,?,?,?,?,?,?)').run(id('obs'),taskId,o.category||'fact',o.content,o.evidence||'',o.confidence??1,now());
    conn.prepare('INSERT OR REPLACE INTO outcomes(outcome_id,task_id,result,success,metrics,limitations,timestamp) VALUES(?,?,?,?,?,?,?)').run(id('out'),taskId,data.result||'',data.success===false?0:1,JSON.stringify(data.metrics||{}),data.limitations||'',now());
    conn.prepare("UPDATE tasks SET status='completed',verification_summary=?,duration_ms=? WHERE task_id=?").run(data.verification||'',data.duration_ms||null,taskId);
    conn.exec('COMMIT');
  } catch(e) { conn.exec('ROLLBACK'); throw e; } finally { conn.close(); }
}
