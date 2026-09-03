from __future__ import annotations
import json
from .common import DB_PATH, connect, make_id, now, revision

def start_task(request:str, task_type="general", run_id=None, db_path=DB_PATH):
    task_id=make_id("task"); run_id=run_id or make_id("run")
    with connect(db_path) as db: db.execute("INSERT INTO tasks(task_id,timestamp,request_text,task_type,status,repository_revision,lifecycle_run_id) VALUES(?,?,?,?,?,?,?)",(task_id,now(),request,task_type,"started",revision(),run_id))
    return {"task_id":task_id,"lifecycle_run_id":run_id}
def finish_task(task_id:str, data=None, db_path=DB_PATH):
    data=data or {}; db=connect(db_path)
    try:
        db.execute("BEGIN IMMEDIATE"); task=db.execute("SELECT status FROM tasks WHERE task_id=?",(task_id,)).fetchone()
        if not task: raise ValueError(f"Unknown task: {task_id}")
        final_status="completed" if data.get("success",True) else "failed"
        if task["status"] in ("completed","failed"): db.rollback(); return {"changed":False,"status":task["status"]}
        for file in data.get("files",[]): db.execute("INSERT OR REPLACE INTO task_files(task_id,file_path,relationship,inspected,modified,verified_relevant,discovery_source,retrieved_rank) VALUES(?,?,?,?,?,?,?,?)",(task_id,file["path"],file.get("relationship","implementation"),bool(file.get("inspected")),bool(file.get("modified")),bool(file.get("relevant")),file.get("source","repository_search"),file.get("retrieved_rank")))
        for item in data.get("observations",[]): db.execute("INSERT INTO observations VALUES(?,?,?,?,?,?,?)",(make_id("obs"),task_id,item.get("category","fact"),item["content"],item.get("evidence",""),item.get("confidence",1),now()))
        for failure in data.get("failures",[]): db.execute("INSERT INTO failures VALUES(?,?,?,?,?,?,?,?)",(make_id("failure"),task_id,failure.get("category","unknown"),failure.get("symptom",""),failure.get("cause",""),failure.get("fix",""),failure.get("verification",""),failure.get("status","open")))
        stamp=now(); rev=revision()
        for memory in data.get("memory",[]): db.execute("INSERT OR REPLACE INTO memory_chunks(chunk_id,source,topic,content,active,confidence,evidence_revision,valid_from_revision,last_verified_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",(memory.get("chunk_id",make_id("memory")),memory.get("source","verified_task"),memory["topic"],memory["content"],1,memory.get("confidence",1),rev,rev,rev,stamp,stamp))
        db.execute("INSERT INTO outcomes VALUES(?,?,?,?,?,?,?)",(make_id("out"),task_id,data.get("result",""),data.get("success",True),json.dumps(data.get("metrics",{})),data.get("limitations",""),now())); db.execute("UPDATE tasks SET status=?,verification_summary=?,duration_ms=? WHERE task_id=?",(final_status,data.get("verification",""),data.get("duration_ms"),task_id)); db.commit(); return {"changed":True,"status":final_status}
    except Exception: db.rollback(); raise
    finally: db.close()
