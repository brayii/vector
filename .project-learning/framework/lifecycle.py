#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
if __package__:
    from .bootstrap import bootstrap
    from .collect import finish_task,start_task
    from .common import ROOT,connect,now,read_json,repository_lock,write_json_atomic
    from .dataset import build_dataset
    from .evaluate import evaluate
    from .health import assess_health,detect_stall
    from .memory import rebuild_memory
    from .recover import open_incident,recover,recovery_status
    from .registry import registry,rollback
    from .retrieve import retrieve
    from .train import train
else:
    sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
    from framework.bootstrap import bootstrap
    from framework.collect import finish_task,start_task
    from framework.common import ROOT,connect,now,read_json,repository_lock,write_json_atomic
    from framework.dataset import build_dataset
    from framework.evaluate import evaluate
    from framework.health import assess_health,detect_stall
    from framework.memory import rebuild_memory
    from framework.recover import open_incident,recover,recovery_status
    from framework.registry import registry,rollback
    from framework.retrieve import retrieve
    from framework.train import train

def status():
    with connect() as db:
        completed=db.execute("SELECT COUNT(*) FROM tasks WHERE status='completed'").fetchone()[0]; started=db.execute("SELECT COUNT(*) FROM tasks WHERE status='started'").fetchone()[0]; recovered=db.execute("SELECT COUNT(*) FROM recovery_incidents WHERE resolution_status='resolved'").fetchone()[0]; last_training=db.execute("SELECT MAX(created_at) FROM models").fetchone()[0]; last_evaluation=db.execute("SELECT MAX(timestamp) FROM evaluations").fetchone()[0]
    config=read_json(ROOT/"config.json"); reg=registry(); health=read_json(ROOT/"runtime"/"health.json",{"state":"UNKNOWN"}); incidents=recovery_status(persist=False)["unresolved_incidents"]; interval=config["lifecycle"]["reevaluate_every_new_tasks"]; remainder=completed%interval
    result={"framework_initialized":True,"schema_version":config["schema_version"],"current_health":health["state"],"unresolved_recovery_incidents":len(incidents),"total_completed_tasks":completed,"total_usable_training_examples":completed,"usable_recovery_examples":recovered,"active_objectives":["context_retrieval"],"current_champions":{key:value["champion"] for key,value in reg.get("objectives",{}).items()},"last_training_time":last_training,"last_evaluation_time":last_evaluation,"next_lifecycle_threshold":interval if remainder==0 else interval-remainder,"pending_lifecycle_work":"; ".join(x for x in (f"{started} task(s) in progress" if started else "",f"{len(incidents)} recovery incident(s)" if incidents else "") if x) or "none","drift_monitoring_status":"baseline; insufficient post-promotion evidence","known_limitations":["Context retrieval lacks independent held-out relevance judgments"]}
    text=f'''# Project Learning Status\n\n- Framework initialized: yes; schema version: {result["schema_version"]}\n- Current health: {result["current_health"]}\n- Unresolved recovery incidents: {len(incidents)}\n- Completed tasks: {completed}\n- Usable training examples: {completed}; recovery examples: {recovered}\n- Active objectives: context retrieval\n- Current champion: {result["current_champions"].get("context_retrieval")}\n- Last training: {last_training or "none"}; evaluation: {last_evaluation or "none"}\n- Next lifecycle threshold: {result["next_lifecycle_threshold"]} task(s)\n- Pending work: {result["pending_lifecycle_work"]}\n- Drift status: {result["drift_monitoring_status"]}\n- Known limitations: {'; '.join(result["known_limitations"])}\n'''; (ROOT/"STATUS.md").write_text(text,encoding="utf-8"); write_json_atomic(ROOT/"state.json",{**result,"updated_at":now()}); return result
def eligibility():
    with connect() as db: rows=db.execute("SELECT task_type,COUNT(*) FROM tasks WHERE status='completed' GROUP BY task_type").fetchall()
    total=sum(r[1] for r in rows); config=read_json(ROOT/"config.json")["lifecycle"]; reasons=[]
    if total<config["min_tasks_for_tfidf"]: reasons.append("insufficient tasks")
    if len(rows)<config["min_distinct_task_families"]: reasons.append("insufficient distinct task families")
    return {"eligible":not reasons,"total":total,"distinct_task_families":len(rows),"reasons":reasons}
def pre_task(request): return {**start_task(request),"health":assess_health(),"recovery":recovery_status(),"context":retrieve(request)}
def post_task(task_id,result):
    completion=finish_task(task_id,{"result":result,"verification":"Python lifecycle post-task","success":True,"memory":[{"chunk_id":f"task_outcome_{task_id}","topic":"verified_task_outcome","content":result,"confidence":.8}]}); rebuild_memory(); health=assess_health(); recovery_status(); eligible=eligibility(); evaluation=evaluate(train()) if eligible["eligible"] else None; return {"completion":completion,"health":health,"eligibility":eligible,"evaluation":evaluation,"status":status()}
def fail_task(task_id,result):
    completion=finish_task(task_id,{"result":result,"verification":"Python lifecycle failed-task","success":False,"failures":[{"category":"agent_task","symptom":result,"status":"open"}]}); rebuild_memory(); health=assess_health(); recovery_status(); return {"completion":completion,"health":health,"status":status()}
def run(operation,args):
    if operation=="bootstrap": return bootstrap()
    if operation=="pre-task": return pre_task(" ".join(args))
    if operation=="post-task": return post_task(args[0]," ".join(args[1:]) or "completed")
    if operation=="fail-task": return fail_task(args[0]," ".join(args[1:]) or "failed")
    if operation=="health": return assess_health()
    if operation=="detect-stall":
        detected=detect_stall(json.loads(args[0]) if args else {})
        if detected["stalled"]: detected["incident"]=open_incident(detected["health"]["failure_signature"],(json.loads(args[0]).get("component","framework") if args else "framework"),"high",detected["health"])
        return detected
    if operation=="recover": return recover(args[0],args[1] if len(args)>1 else None)
    if operation=="recovery-status": return recovery_status()
    if operation=="train": return train(args[0] if args else "context_retrieval")
    if operation=="evaluate": return evaluate(train(args[0] if args else "context_retrieval"))
    if operation=="status": return status()
    if operation=="rebuild-memory": return rebuild_memory()
    if operation=="rollback": return rollback(args[0] if args else "context_retrieval")
    if operation=="dataset": return build_dataset(args[0] if args else "context_retrieval")
    if operation=="retrieve": return retrieve(" ".join(args))
    raise ValueError(f"Unknown operation: {operation}")
def main():
    parser=argparse.ArgumentParser(); parser.add_argument("operation",nargs="?",default="status"); parser.add_argument("args",nargs="*"); parsed=parser.parse_args(); mutating=parsed.operation not in {"status","recovery-status","retrieve"}
    try:
        if mutating:
            with repository_lock(): result=run(parsed.operation,parsed.args)
        else: result=run(parsed.operation,parsed.args)
        print(json.dumps(result,indent=2))
    except Exception as error: print(f"{type(error).__name__}: {error}",file=sys.stderr); return 1
    return 0
if __name__=="__main__": raise SystemExit(main())
