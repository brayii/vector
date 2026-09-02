from __future__ import annotations
import json, time
from .common import DB_PATH, ROOT, connect, make_id, now, read_json, revision, write_json_atomic
from .health import assess_health
from .memory import rebuild_memory
RECOVERY_LADDER=("recheck_health","retry_transient","reset_transient_state","restart_component","rebuild_derived_state","fallback_challenger_to_champion","fallback_champion_to_baseline","rollback_recent_artifact","isolate_optional_subsystem","create_code_repair_incident","patch_verified_defect","enter_failed_safe")
AUTOMATIC={"recheck_health","reset_transient_state","rebuild_derived_state","fallback_challenger_to_champion","fallback_champion_to_baseline","isolate_optional_subsystem","enter_failed_safe"}
def open_incident(failure_signature,component="framework",severity="medium",state_before=None,db_path=DB_PATH):
    with connect(db_path) as db:
        existing=db.execute("SELECT * FROM recovery_incidents WHERE failure_signature=? AND resolution_status='open'",(failure_signature,)).fetchone()
        if existing:return dict(existing)
        incident={"incident_id":make_id("incident"),"started_at":now(),"component":component,"failure_signature":failure_signature,"severity":severity,"state_before":json.dumps(state_before or {}),"resolution_status":"open","repository_revision":revision()}; db.execute("INSERT INTO recovery_incidents(incident_id,started_at,component,failure_signature,severity,state_before,resolution_status,repository_revision) VALUES(?,?,?,?,?,?,?,?)",tuple(incident.values())); return incident
def recovery_status(db_path=DB_PATH,persist=True):
    with connect(db_path) as db: incidents=[dict(r) for r in db.execute("SELECT * FROM recovery_incidents WHERE resolution_status='open' ORDER BY started_at")]; attempts=[dict(r) for r in db.execute("SELECT * FROM recovery_attempts ORDER BY timestamp")]
    result={"checked_at":now(),"unresolved_incidents":incidents,"attempts":[a for a in attempts if any(i["incident_id"]==a["incident_id"] for i in incidents)]}
    if persist: write_json_atomic(ROOT/"runtime"/"recovery.json",result)
    return result
def recover(incident_id,action=None,reason="bounded deterministic recovery",db_path=DB_PATH,verify=None):
    config=read_json(ROOT/"config.json")["recovery"]; db=connect(db_path); incident=db.execute("SELECT * FROM recovery_incidents WHERE incident_id=?",(incident_id,)).fetchone()
    if not incident: db.close(); raise ValueError("Unknown recovery incident")
    if incident["resolution_status"]=="resolved": db.close(); return {"changed":False,"status":"resolved"}
    prior=[dict(r) for r in db.execute("SELECT * FROM recovery_attempts WHERE incident_id=? ORDER BY attempt_number",(incident_id,))]; selected=action or next((x for x in RECOVERY_LADDER if x in AUTOMATIC and sum(a["action"]==x for a in prior)<config["max_same_action_repeats"]),None)
    if selected not in AUTOMATIC: db.close(); raise ValueError("Recovery action is not permitted automatically")
    if sum(a["action"]==selected for a in prior)>=config["max_same_action_repeats"]: db.close(); raise RuntimeError("Recovery same-action limit reached")
    if len(prior)>=config["max_attempts_per_incident"]: db.execute("UPDATE recovery_incidents SET resolution_status='failed_safe',resolved_at=?,state_after=? WHERE incident_id=?",(now(),json.dumps({"state":"FAILED_SAFE"}),incident_id)); db.commit(); db.close(); return {"changed":True,"status":"FAILED_SAFE"}
    started=time.monotonic(); result="checked"
    if selected=="rebuild_derived_state": rebuild_memory(db_path); result="memory rebuilt"
    healthy=bool(verify()) if verify else assess_health({},False,db_path)["state"]=="HEALTHY"; verification="health check passed" if healthy else "not recovered"; number=len(prior)+1
    db.execute("INSERT INTO recovery_attempts VALUES(?,?,?,?,?,?,?,?,?,?,?)",(make_id("attempt"),incident_id,number,selected,"deterministic",reason,result,int((time.monotonic()-started)*1000),verification,"none observed",now()))
    if healthy: db.execute("UPDATE recovery_incidents SET resolution_status='resolved',resolved_at=?,state_after=?,root_cause=?,confidence=? WHERE incident_id=?",(now(),json.dumps({"state":"HEALTHY"}),"resolved by bounded recovery",.7,incident_id))
    db.commit(); db.close(); return {"changed":True,"status":"resolved" if healthy else "open","action":selected,"attempt_number":number,"verification":verification}
