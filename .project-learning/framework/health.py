from __future__ import annotations
import hashlib
from .common import DB_PATH, ROOT, connect, now, read_json, revision, write_json_atomic
HEALTH_STATES=("HEALTHY","DEGRADED","STALLED","RECOVERING","FAILED_SAFE","UNKNOWN")
def assess_health(signals=None,persist=True,db_path=DB_PATH):
    signals=signals or {}; config=read_json(ROOT/"config.json"); evidence=[]; state="HEALTHY"
    try:
        with connect(db_path) as db:
            integrity=db.execute("PRAGMA integrity_check").fetchone()[0]
            if integrity!="ok": state="FAILED_SAFE"; evidence.append(f"database_integrity:{integrity}")
    except Exception as error: state="FAILED_SAFE"; evidence.append(f"database_unavailable:{error}")
    for required in ("config.json","models/registry.json"):
        if not (ROOT/required).exists():
            if state=="HEALTHY": state="DEGRADED"
            evidence.append(f"missing:{required}")
    health_config=config["health"]
    if signals.get("repeatedErrors",0)>=health_config["stall_repeated_error_threshold"] or signals.get("repeatedActions",0)>=health_config["stall_repeated_action_threshold"] or signals.get("timeouts",0)>=health_config["timeout_threshold"]: state="STALLED"; evidence.append("configured_stall_threshold_exceeded")
    if signals.get("recovering"): state="RECOVERING"
    elif signals.get("optionalUnavailable") and state=="HEALTHY": state="DEGRADED"; evidence.append("optional_component_unavailable")
    result={"state":state,"checked_at":now(),"repository_revision":revision(),"signals":signals,"evidence":evidence,"failure_signature":hashlib.sha256("|".join(evidence).encode()).hexdigest()[:16] if evidence else None}
    if persist: write_json_atomic(ROOT/"runtime"/"health.json",result)
    return result
def detect_stall(signals=None,persist=True,db_path=DB_PATH):
    health=assess_health(signals,persist,db_path); return {"stalled":health["state"]=="STALLED","health":health,"reason":", ".join(health["evidence"]) if health["state"]=="STALLED" else "stall threshold not met"}
