from __future__ import annotations
import json, os, tempfile
from pathlib import Path
from .common import DB_PATH, ROOT, connect, now, revision, write_json_atomic
def rebuild_memory(db_path=DB_PATH):
    with connect(db_path) as db: chunks=[dict(row) for row in db.execute("SELECT * FROM memory_chunks WHERE active=1 ORDER BY updated_at DESC")]
    directory=ROOT/"memory"; directory.mkdir(parents=True,exist_ok=True); write_json_atomic(directory/"index.json",{"version":1,"count":len(chunks),"rebuilt_at":now(),"repository_revision":revision(),"chunks":[{key:c.get(key) for key in ("chunk_id","topic","confidence","last_verified_revision")} for c in chunks]})
    fd,temp=tempfile.mkstemp(dir=directory); os.close(fd); temporary=Path(temp); temporary.write_text("".join(json.dumps(c)+"\n" for c in chunks),encoding="utf-8"); os.replace(temporary,directory/"chunks.jsonl"); return {"count":len(chunks)}
def remember(chunk_id,topic,content,source="task",confidence=1,db_path=DB_PATH):
    stamp=now(); rev=revision()
    with connect(db_path) as db: db.execute("INSERT INTO memory_chunks(chunk_id,source,topic,content,active,confidence,evidence_revision,valid_from_revision,last_verified_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(chunk_id) DO UPDATE SET source=excluded.source,topic=excluded.topic,content=excluded.content,active=1,confidence=excluded.confidence,evidence_revision=excluded.evidence_revision,last_verified_revision=excluded.last_verified_revision,updated_at=excluded.updated_at",(chunk_id,source,topic,content,1,confidence,rev,rev,rev,stamp,stamp))
def invalidate_memory(chunk_id,invalidated_revision=None,db_path=DB_PATH):
    with connect(db_path) as db: result=db.execute("UPDATE memory_chunks SET active=0,invalidated_revision=?,updated_at=? WHERE chunk_id=? AND active=1",(invalidated_revision or revision(),now(),chunk_id)); return {"changed":result.rowcount>0}
