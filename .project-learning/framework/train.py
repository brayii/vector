from __future__ import annotations
import json, time
from pathlib import Path
from .common import DB_PATH, ROOT, connect, now, write_json_atomic
from .dataset import build_dataset
def save_model(model,path): write_json_atomic(Path(path),model); return str(path)
def load_model(path): return json.loads(Path(path).read_text(encoding="utf-8"))
def train(objective="context_retrieval",db_path=DB_PATH,output_root=ROOT):
    started=time.monotonic(); dataset=build_dataset(objective,db_path,output_root); model={"model_id":f'lexical-{dataset["dataset_id"]}',"objective":objective,"type":"deterministic-lexical","dataset_id":dataset["dataset_id"],"created_at":now(),"status":"challenger","training_seconds":time.monotonic()-started}; artifact=Path(output_root)/"models"/"challengers"/f'{model["model_id"]}.json'; save_model(model,artifact)
    with connect(db_path) as db: db.execute("INSERT OR REPLACE INTO models VALUES(?,?,?,?,?,?,?,?)",(model["model_id"],objective,"lexical-v1",str(artifact),dataset["dataset_id"],json.dumps({"training_seconds":model["training_seconds"]}),model["status"],model["created_at"])); return {**model,"artifact_path":str(artifact)}
