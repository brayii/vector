import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1')), '..');
export const REPO = path.resolve(ROOT, '..');
export const DB_PATH = path.join(ROOT, 'data', 'learning.db');
export const now = () => new Date().toISOString();
export const id = (prefix) => `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
export const readJson = (p, fallback = {}) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;
export function writeJsonAtomic(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, p);
}
export function revision() {
  try {
    const git = fs.readFileSync(path.join(REPO, '.git', 'HEAD'), 'utf8').trim();
    return crypto.createHash('sha256').update(git).digest('hex').slice(0, 12);
  } catch { return 'unversioned'; }
}
export function tokenize(text) {
  return [...new Set(String(text).toLowerCase().match(/[a-z0-9_]{2,}/g) || [])];
}
export function db(openPath = DB_PATH) {
  fs.mkdirSync(path.dirname(openPath), { recursive: true });
  const conn = new DatabaseSync(openPath);
  conn.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  return conn;
}
export function migrate(conn) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks(task_id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, request_text TEXT NOT NULL, task_type TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER, verification_summary TEXT, repository_revision TEXT, lifecycle_run_id TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS task_files(task_id TEXT NOT NULL, file_path TEXT NOT NULL, relationship TEXT, inspected INTEGER DEFAULT 0, modified INTEGER DEFAULT 0, verified_relevant INTEGER DEFAULT 0, discovery_source TEXT, retrieved_rank INTEGER, PRIMARY KEY(task_id,file_path), FOREIGN KEY(task_id) REFERENCES tasks(task_id));
    CREATE TABLE IF NOT EXISTS observations(observation_id TEXT PRIMARY KEY, task_id TEXT, category TEXT, content TEXT, evidence TEXT, confidence REAL, timestamp TEXT, FOREIGN KEY(task_id) REFERENCES tasks(task_id));
    CREATE TABLE IF NOT EXISTS outcomes(outcome_id TEXT PRIMARY KEY, task_id TEXT UNIQUE, result TEXT, success INTEGER, metrics TEXT, limitations TEXT, timestamp TEXT, FOREIGN KEY(task_id) REFERENCES tasks(task_id));
    CREATE TABLE IF NOT EXISTS memory_chunks(chunk_id TEXT PRIMARY KEY, source TEXT, topic TEXT, content TEXT, active INTEGER DEFAULT 1, confidence REAL DEFAULT 1, evidence_revision TEXT, valid_from_revision TEXT, last_verified_revision TEXT, invalidated_revision TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS failures(failure_id TEXT PRIMARY KEY, task_id TEXT, category TEXT, symptom TEXT, cause TEXT, fix TEXT, verification TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS decisions(decision_id TEXT PRIMARY KEY, task_id TEXT, decision TEXT, rationale TEXT, consequences TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS experiments(experiment_id TEXT PRIMARY KEY, objective TEXT, baseline TEXT, challenger TEXT, dataset_version TEXT, config TEXT, status TEXT, timestamp TEXT);
    CREATE TABLE IF NOT EXISTS evaluations(evaluation_id TEXT PRIMARY KEY, experiment_id TEXT, model_id TEXT, metric TEXT, value REAL, split TEXT, timestamp TEXT);
    CREATE TABLE IF NOT EXISTS models(model_id TEXT PRIMARY KEY, objective TEXT, version TEXT, artifact_path TEXT, training_data_version TEXT, metrics TEXT, status TEXT, created_at TEXT);
    INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, '${now()}');
  `);
}
export function ensureDb(openPath) { const conn = db(openPath); migrate(conn); return conn; }
