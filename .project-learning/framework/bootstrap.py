from __future__ import annotations
from .common import ROOT, REPO, connect, now, revision, write_json_atomic
from .health import assess_health
from .memory import rebuild_memory
from .recover import recovery_status
def bootstrap():
    for directory in ("data/exports","models/champion","models/challengers","evals/results","experiments/results","memory","runtime"): (ROOT/directory).mkdir(parents=True,exist_ok=True)
    files=sorted(p.name for p in REPO.iterdir() if p.is_file() and "secret" not in p.name.lower()); stamp=now(); rev=revision()
    with connect() as db:
        if not db.execute("SELECT 1 FROM memory_chunks WHERE chunk_id='initial_repository'").fetchone(): db.execute("INSERT INTO memory_chunks(chunk_id,source,topic,content,active,confidence,evidence_revision,valid_from_revision,last_verified_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",("initial_repository","bootstrap","repository","Initial repository files: "+", ".join(files),1,1,rev,rev,rev,stamp,stamp))
    registry=ROOT/"models"/"registry.json"
    if not registry.exists(): write_json_atomic(registry,{"version":1,"objectives":{"context_retrieval":{"baseline":"lexical-v1","champion":"lexical-v1","challengers":[],"rollback_target":None}}})
    experiments=ROOT/"experiments"/"registry.jsonl"; experiments.touch(exist_ok=True)
    definitions=ROOT/"evals"/"definitions.json"
    if not definitions.exists(): write_json_atomic(definitions,{"version":1,"objectives":{"context_retrieval":["recall@5","mrr","ndcg@5","precision@5"]}})
    rebuild_memory(); assess_health(); recovery_status(); return {"initialized":True,"schema_version":2,"repository_revision":rev,"files":len(files)}
