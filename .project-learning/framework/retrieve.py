from .common import DB_PATH, ROOT, connect, revision, tokenize, write_json_atomic
def retrieve(task, output=True, db_path=DB_PATH):
    terms=tokenize(task)
    def score(text): return sum(term in tokenize(text) for term in terms)
    with connect(db_path) as db:
        memories=sorted(({**dict(r),"score":score(f'{r["topic"]} {r["content"]}')} for r in db.execute("SELECT chunk_id,topic,content,confidence FROM memory_chunks WHERE active=1")),key=lambda x:-x["score"]); memories=[x for x in memories if x["score"]][:5]
        failures=[dict(r) for r in db.execute("SELECT category,symptom,fix FROM failures WHERE status!='resolved' OR status IS NULL")]; failures=[{**x,"score":score(f'{x["category"]} {x["symptom"]}')} for x in failures]; failures=[x for x in failures if x["score"]][:5]
        similar=[dict(r) for r in db.execute("SELECT task_id,request_text,task_type FROM tasks WHERE status='completed'")]; similar=sorted(({**x,"score":score(x["request_text"])} for x in similar),key=lambda x:-x["score"]); similar=[x for x in similar if x["score"]][:5]
        files=[dict(r) for r in db.execute("SELECT file_path,COUNT(*) uses,MAX(verified_relevant) relevant FROM task_files GROUP BY file_path")]; files=sorted(({**x,"score":score(x["file_path"])+(1 if x["relevant"] else 0)} for x in files),key=lambda x:-x["score"]); files=[x for x in files if x["score"]][:8]
        decisions=[dict(r) for r in db.execute("SELECT decision_id,decision,rationale,status FROM decisions WHERE status IS NULL OR status!='retired'")]; decisions=[{**x,"score":score(f'{x["decision"]} {x["rationale"]}')} for x in decisions]; decisions=[x for x in decisions if x["score"]][:5]
        incidents=[dict(r) for r in db.execute("SELECT incident_id,component,failure_signature,severity,resolution_status FROM recovery_incidents WHERE resolution_status='open'")]
    packet={"task":task,"repository_revision":revision(),"relevant_memory":memories,"likely_files":files,"known_failures":failures,"unresolved_recovery_incidents":incidents,"related_decisions":decisions,"similar_tasks":similar,"retriever_versions":{"context":"lexical-v1"},"confidence":{"context":"medium" if memories else "low"}}
    if output: write_json_atomic(ROOT/"runtime"/"context.json",packet)
    return packet
