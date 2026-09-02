from __future__ import annotations
import json, math
from .common import DB_PATH, connect, make_id, now
def ranking_metrics(relevances,k=5):
    top=relevances[:k]; positives=sum(bool(x) for x in relevances); first=next((i for i,x in enumerate(top) if x),None); dcg=sum(1/math.log2(i+2) for i,x in enumerate(top) if x); ideal=sum(1/math.log2(i+2) for i in range(min(positives,k))); return {f"recall@{k}":sum(bool(x) for x in top)/positives if positives else 1,"mrr":0 if first is None else 1/(first+1),f"ndcg@{k}":dcg/ideal if ideal else 1,f"precision@{k}":sum(bool(x) for x in top)/k}
def evaluate(model,db_path=DB_PATH):
    result={"model_id":model["model_id"],"status":"exploratory","held_out":False,"reason":"Insufficient independent held-out relevance judgments for statistically valid promotion","metrics":{}}; experiment=make_id("experiment")
    with connect(db_path) as db: db.execute("INSERT INTO experiments VALUES(?,?,?,?,?,?,?,?)",(experiment,model["objective"],"lexical-v1",model["model_id"],model["dataset_id"],json.dumps({"type":model["type"]}),result["status"],now())); db.execute("INSERT INTO evaluations VALUES(?,?,?,?,?,?,?)",(make_id("evaluation"),experiment,model["model_id"],"insufficient_evidence",0,"held-out",now()))
    return result
