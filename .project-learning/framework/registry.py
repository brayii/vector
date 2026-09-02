from pathlib import Path
from .common import ROOT, now, read_json, write_json_atomic
def registry(path=None): return read_json(Path(path) if path else ROOT/"models"/"registry.json",{"version":1,"objectives":{}})
def promote(objective,challenger,evaluation,path=None):
    target=Path(path) if path else ROOT/"models"/"registry.json"; data=registry(target); item=data.get("objectives",{}).get(objective)
    if not item: raise ValueError("Unknown objective")
    if evaluation.get("status")!="eligible" or not evaluation.get("held_out"): return {"changed":False,"reason":"Challenger lacks eligible held-out evaluation"}
    item["rollback_target"]=item["champion"]; item["champion"]=challenger["model_id"]; item.setdefault("challengers",[]).append({"model_id":challenger["model_id"],"status":"promoted","metrics":evaluation.get("metrics",{}),"dataset_id":challenger.get("dataset_id"),"promoted_at":now()}); write_json_atomic(target,data); return {"changed":True,"champion":item["champion"],"rollback_target":item["rollback_target"]}
def rollback(objective="context_retrieval",path=None):
    target=Path(path) if path else ROOT/"models"/"registry.json"; data=registry(target); item=data.get("objectives",{}).get(objective)
    if not item or not item.get("rollback_target"): return {"changed":False,"reason":"No rollback target"}
    item["champion"],item["rollback_target"]=item["rollback_target"],item["champion"]; write_json_atomic(target,data); return {"changed":True,"champion":item["champion"]}
