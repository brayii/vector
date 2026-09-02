import json, sqlite3, sys, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
from framework.collect import finish_task,start_task
from framework.common import connect,repository_lock,write_json_atomic
from framework.dataset import build_dataset
from framework.evaluate import ranking_metrics
from framework.features import lexical_features
from framework.health import HEALTH_STATES,assess_health,detect_stall
from framework.lifecycle import eligibility
from framework.memory import invalidate_memory,remember
from framework.recover import RECOVERY_LADDER,open_incident,recover,recovery_status
from framework.registry import promote,rollback
from framework.retrieve import retrieve
from framework.train import load_model,save_model

class FrameworkTests(unittest.TestCase):
    def fixture(self):
        directory=Path(tempfile.mkdtemp(prefix="vector-learning-")); return directory,directory/"learning.db"
    def test_schema_v2_and_recovery_tables(self):
        _,db_path=self.fixture()
        with connect(db_path) as db:
            self.assertEqual(db.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0],2)
            tables={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertTrue({"recovery_incidents","recovery_attempts","datasets","runtime_events"}<=tables)
    def test_collection_transaction_and_idempotency(self):
        _,db_path=self.fixture(); task=start_task("synthetic","test","run_test",db_path)
        self.assertTrue(finish_task(task["task_id"],{"result":"verified","observations":[{"content":"fact"}]},db_path)["changed"])
        self.assertFalse(finish_task(task["task_id"],{"result":"duplicate"},db_path)["changed"])
        with connect(db_path) as db:self.assertEqual(db.execute("SELECT COUNT(*) FROM outcomes").fetchone()[0],1)
    def test_dataset_dedup_and_chronological_split(self):
        directory,db_path=self.fixture()
        for index in range(5):
            task=start_task("task 3" if index==4 else f"task {index}","test",f"run_{index}",db_path); finish_task(task["task_id"],{"result":"ok"},db_path)
        data=build_dataset("test",db_path,directory); self.assertEqual(len(data["included_task_ids"]),4); self.assertFalse({x["task_id"] for x in data["train"]}&{x["task_id"] for x in data["test"]})
    def test_features_and_evaluation_metrics(self):
        self.assertEqual(lexical_features("happy birthday","birthday card"),{"overlap":1,"query_terms":2,"document_terms":2}); self.assertEqual(ranking_metrics([0,1,0])["mrr"],.5); self.assertIn("precision@5",ranking_metrics([1,0]))
    def test_context_shape_and_provenance(self):
        packet=retrieve("framework recovery",False)
        for field in ("relevant_memory","likely_files","known_failures","unresolved_recovery_incidents","related_decisions","similar_tasks"):self.assertIsInstance(packet[field],list)
        self.assertEqual(packet["retriever_versions"]["context"],"lexical-v1")
    def test_health_transitions_and_stall_threshold(self):
        _,db_path=self.fixture(); self.assertTrue(set(("HEALTHY","DEGRADED","STALLED","RECOVERING","FAILED_SAFE","UNKNOWN"))<=set(HEALTH_STATES)); self.assertEqual(assess_health({},False,db_path)["state"],"HEALTHY"); self.assertEqual(assess_health({"optionalUnavailable":True},False,db_path)["state"],"DEGRADED"); self.assertEqual(assess_health({"recovering":True},False,db_path)["state"],"RECOVERING"); self.assertTrue(detect_stall({"repeatedErrors":3},False,db_path)["stalled"]); self.assertFalse(detect_stall({"repeatedErrors":1},False,db_path)["stalled"])
    def test_recovery_order_idempotency_and_attempt_evidence(self):
        self.assertEqual(RECOVERY_LADDER[:3],("recheck_health","retry_transient","reset_transient_state")); self.assertEqual(RECOVERY_LADDER[-1],"enter_failed_safe"); _,db_path=self.fixture(); one=open_incident("synthetic",state_before={"state":"STALLED"},db_path=db_path); same=open_incident("synthetic",db_path=db_path); self.assertEqual(one["incident_id"],same["incident_id"]); self.assertEqual(recover(one["incident_id"],db_path=db_path,verify=lambda:True)["status"],"resolved"); self.assertEqual(len(recovery_status(db_path,False)["unresolved_incidents"]),0)
    def test_recovery_same_action_is_bounded(self):
        _,db_path=self.fixture(); incident=open_incident("repeat",db_path=db_path); recover(incident["incident_id"],"recheck_health",db_path=db_path,verify=lambda:False); recover(incident["incident_id"],"recheck_health",db_path=db_path,verify=lambda:False)
        with self.assertRaisesRegex(RuntimeError,"same-action limit"):recover(incident["incident_id"],"recheck_health",db_path=db_path,verify=lambda:False)
    def test_memory_invalidation_preserves_provenance(self):
        _,db_path=self.fixture(); remember("one","test","verified",db_path=db_path); self.assertTrue(invalidate_memory("one","revision_2",db_path)["changed"])
        with connect(db_path) as db: row=db.execute("SELECT active,invalidated_revision FROM memory_chunks WHERE chunk_id='one'").fetchone(); self.assertEqual((row[0],row[1]),(0,"revision_2"))
    def test_registry_promotion_guard_and_rollback(self):
        directory,_=self.fixture(); path=directory/"registry.json"; write_json_atomic(path,{"version":1,"objectives":{"context_retrieval":{"baseline":"lexical-v1","champion":"lexical-v1","challengers":[],"rollback_target":None}}}); self.assertFalse(promote("context_retrieval",{"model_id":"bad"},{"status":"exploratory","held_out":False},path)["changed"]); self.assertTrue(promote("context_retrieval",{"model_id":"good","dataset_id":"d1"},{"status":"eligible","held_out":True,"metrics":{"mrr":1}},path)["changed"]); self.assertEqual(rollback("context_retrieval",path)["champion"],"lexical-v1")
    def test_model_save_load(self):
        directory,_=self.fixture(); path=directory/"model.json"; model={"model_id":"synthetic","weights":[1,2,3]}; save_model(model,path); self.assertEqual(load_model(path),model)
    def test_repository_lock_exclusion(self):
        with repository_lock():
            with self.assertRaisesRegex(RuntimeError,"lock is busy"):
                with repository_lock(timeout=.03):pass
        with repository_lock():pass
    def test_lifecycle_eligibility_is_evidence_based(self):
        result=eligibility(); self.assertIsInstance(result["eligible"],bool); self.assertIsInstance(result["total"],int); self.assertIsInstance(result["reasons"],list); self.assertEqual(result["eligible"],result["distinct_task_families"]>=3 and result["total"]>=10)

if __name__=="__main__":unittest.main()
