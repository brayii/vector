from __future__ import annotations
import contextlib, hashlib, json, os, re, sqlite3, subprocess, tempfile, time, uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
DB_PATH = ROOT / "data" / "learning.db"

def now() -> str: return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
def make_id(prefix: str) -> str: return f"{prefix}_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}"
def read_json(path: Path, fallback=None):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError: return {} if fallback is None else fallback
def write_json_atomic(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(value, handle, indent=2); handle.write("\n"); temporary = Path(handle.name)
    os.replace(temporary, path)
def revision() -> str:
    try: return subprocess.check_output(["git", "rev-parse", "--short=12", "HEAD"], cwd=REPO, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception: return "unversioned"
def tokenize(text: str) -> list[str]: return list(dict.fromkeys(re.findall(r"[a-z0-9_]{2,}", str(text).lower())))

class ClosingConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc_value, traceback):
        result=super().__exit__(exc_type,exc_value,traceback); self.close(); return result

def connect(path: Path | str = DB_PATH) -> sqlite3.Connection:
    target=Path(path); target.parent.mkdir(parents=True, exist_ok=True); connection=sqlite3.connect(target, timeout=5, factory=ClosingConnection); connection.row_factory=sqlite3.Row
    connection.executescript("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;"); migrate(connection); return connection

def migrate(connection: sqlite3.Connection) -> None:
    connection.executescript("""
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks(task_id TEXT PRIMARY KEY,timestamp TEXT NOT NULL,request_text TEXT NOT NULL,task_type TEXT NOT NULL,status TEXT NOT NULL,duration_ms INTEGER,verification_summary TEXT,repository_revision TEXT,lifecycle_run_id TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS task_files(task_id TEXT NOT NULL,file_path TEXT NOT NULL,relationship TEXT,inspected INTEGER DEFAULT 0,modified INTEGER DEFAULT 0,verified_relevant INTEGER DEFAULT 0,discovery_source TEXT,retrieved_rank INTEGER,PRIMARY KEY(task_id,file_path),FOREIGN KEY(task_id) REFERENCES tasks(task_id));
    CREATE TABLE IF NOT EXISTS observations(observation_id TEXT PRIMARY KEY,task_id TEXT,category TEXT,content TEXT,evidence TEXT,confidence REAL,timestamp TEXT,FOREIGN KEY(task_id) REFERENCES tasks(task_id));
    CREATE TABLE IF NOT EXISTS outcomes(outcome_id TEXT PRIMARY KEY,task_id TEXT UNIQUE,result TEXT,success INTEGER,metrics TEXT,limitations TEXT,timestamp TEXT,FOREIGN KEY(task_id) REFERENCES tasks(task_id));
    CREATE TABLE IF NOT EXISTS memory_chunks(chunk_id TEXT PRIMARY KEY,source TEXT,topic TEXT,content TEXT,active INTEGER DEFAULT 1,confidence REAL DEFAULT 1,evidence_revision TEXT,valid_from_revision TEXT,last_verified_revision TEXT,invalidated_revision TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE IF NOT EXISTS failures(failure_id TEXT PRIMARY KEY,task_id TEXT,category TEXT,symptom TEXT,cause TEXT,fix TEXT,verification TEXT,status TEXT);
    CREATE TABLE IF NOT EXISTS decisions(decision_id TEXT PRIMARY KEY,task_id TEXT,decision TEXT,rationale TEXT,consequences TEXT,status TEXT);
    CREATE TABLE IF NOT EXISTS experiments(experiment_id TEXT PRIMARY KEY,objective TEXT,baseline TEXT,challenger TEXT,dataset_version TEXT,config TEXT,status TEXT,timestamp TEXT);
    CREATE TABLE IF NOT EXISTS evaluations(evaluation_id TEXT PRIMARY KEY,experiment_id TEXT,model_id TEXT,metric TEXT,value REAL,split TEXT,timestamp TEXT);
    CREATE TABLE IF NOT EXISTS models(model_id TEXT PRIMARY KEY,objective TEXT,version TEXT,artifact_path TEXT,training_data_version TEXT,metrics TEXT,status TEXT,created_at TEXT);
    CREATE TABLE IF NOT EXISTS recovery_incidents(incident_id TEXT PRIMARY KEY,started_at TEXT NOT NULL,resolved_at TEXT,component TEXT NOT NULL,failure_signature TEXT NOT NULL UNIQUE,severity TEXT NOT NULL,state_before TEXT,state_after TEXT,root_cause TEXT,confidence REAL,resolution_status TEXT NOT NULL,repository_revision TEXT);
    CREATE TABLE IF NOT EXISTS recovery_attempts(attempt_id TEXT PRIMARY KEY,incident_id TEXT NOT NULL,attempt_number INTEGER NOT NULL,action TEXT NOT NULL,action_source TEXT NOT NULL,reason TEXT,result TEXT,duration_ms INTEGER,verification TEXT,side_effects TEXT,timestamp TEXT NOT NULL,UNIQUE(incident_id,attempt_number),FOREIGN KEY(incident_id) REFERENCES recovery_incidents(incident_id));
    CREATE TABLE IF NOT EXISTS datasets(dataset_id TEXT PRIMARY KEY,objective TEXT NOT NULL,repository_revision_range TEXT,label_rules TEXT,feature_rules TEXT,exclusions TEXT,split_strategy TEXT,seed INTEGER,duplicate_policy TEXT,included_records TEXT,created_at TEXT);
    CREATE TABLE IF NOT EXISTS runtime_events(event_id TEXT PRIMARY KEY,component TEXT,event_type TEXT,signature TEXT,details TEXT,timestamp TEXT NOT NULL);
    """)
    connection.execute("INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,?)",(now(),)); connection.execute("INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2,?)",(now(),)); connection.commit()

@contextlib.contextmanager
def repository_lock(timeout: float=5, stale: float=300):
    lock=ROOT/"runtime"/"lifecycle.lock"; lock.parent.mkdir(parents=True,exist_ok=True); started=time.monotonic(); descriptor=None
    while descriptor is None:
        try: descriptor=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY); os.write(descriptor,json.dumps({"pid":os.getpid(),"started_at":now()}).encode())
        except FileExistsError:
            try:
                if time.time()-lock.stat().st_mtime>stale: lock.unlink(); continue
            except FileNotFoundError: continue
            if time.monotonic()-started>=timeout: raise RuntimeError("Project-learning lifecycle lock is busy")
            time.sleep(.02)
    try: yield
    finally:
        if descriptor is not None: os.close(descriptor)
        lock.unlink(missing_ok=True)
