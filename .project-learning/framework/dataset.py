from __future__ import annotations
import hashlib, json
from pathlib import Path
from .common import DB_PATH, ROOT, connect, now, write_json_atomic
def build_dataset(objective="context_retrieval",db_path=DB_PATH,output_root=ROOT):
    db=connect(db_path); raw=[dict(r) for r in db.execute("SELECT task_id,timestamp,request_text,task_type,repository_revision FROM tasks WHERE status='completed' AND length(trim(request_text))>0 ORDER BY timestamp,task_id")]; seen=set(); rows=[]
    for row in raw:
        key=row["request_text"].strip().lower()
        if key not in seen: seen.add(key); rows.append(row)
    dataset_id=f'{objective}-{hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()[:12]}'; cut=len(rows) if len(rows)<2 else max(1,int(len(rows)*.8)); value={"dataset_id":dataset_id,"created_at":now(),"objective":objective,"included_task_ids":[r["task_id"] for r in rows],"repository_revision_range":[rows[0].get("repository_revision") if rows else None,rows[-1].get("repository_revision") if rows else None],"label_rules":"verified structured evidence only","feature_rules":"lexical-v1","exclusions":{"exact_duplicates":len(raw)-len(rows),"near_duplicates":"not yet measured"},"split_strategy":"chronological-80-20","random_seed":0,"duplicate_policy":"exact normalized request deduplication","train":rows[:cut],"test":rows[cut:]}
    db.execute("INSERT OR REPLACE INTO datasets VALUES(?,?,?,?,?,?,?,?,?,?,?)",(dataset_id,objective,json.dumps(value["repository_revision_range"]),value["label_rules"],value["feature_rules"],json.dumps(value["exclusions"]),value["split_strategy"],0,value["duplicate_policy"],json.dumps(value["included_task_ids"]),value["created_at"])); db.commit(); db.close(); write_json_atomic(Path(output_root)/"data"/"exports"/f"{dataset_id}.json",value); return value
