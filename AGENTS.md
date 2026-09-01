# AGENTS.md — Adaptive Project Learning and Recovery Framework

## Objective

Maintain an executable, persistent machine-learning framework inside this repository.

The framework must learn from coding work and observable runtime behavior, convert verified activity into structured data, train project-specific models when sufficient evidence exists, evaluate challengers against deterministic baselines and current champions, promote only measured improvements, and use learned results to improve future work.

The framework must also recognize unhealthy or stalled states, attempt bounded safe recovery, preserve evidence, and learn from recovery outcomes.

Core lifecycle:

```text
task / runtime event
    ↓
retrieve learned context
    ↓
inspect repository + runtime evidence
    ↓
work / run / observe
    ↓
verify / measure
    ↓
record task + outcome + failures
    ↓
update memory + datasets
    ↓
train/evaluate when eligible
    ↓
promote only if better
    ↓
monitor health
    ↓
detect stall / failure
    ↓
recover / repair / rollback / fallback
    ↓
verify recovery + learn
    ↺
```

---

# 1. Mandatory Behavior

For every coding task:

1. Load framework state, health, and relevant learned context.
2. Inspect unresolved recovery incidents.
3. Inspect current code, tests, configuration, logs, and runtime evidence.
4. Stabilize a critical unhealthy state before unrelated work when required.
5. Perform the requested work.
6. Verify the result when practical.
7. Record useful task, file, observation, failure, recovery, verification, and outcome evidence.
8. Update persistent memory.
9. Run lifecycle, health, and recovery checks.
10. Run eligible training/evaluation within configured resource limits.
11. Use promoted models on later tasks.

Do not wait for another prompt to run permitted lifecycle work.

Do not claim improvement, diagnosis, or recovery without evidence.

Current repository and runtime evidence override stale learned memory and model predictions.

---

# 2. Initialization

Treat requests such as `initialize project`, `initialize learning framework`, `bootstrap project`, or `set up project learning` as initialization commands.

Initialization must create working infrastructure, not only documentation.

It must:

1. inspect the repository and available runtime;
2. detect dependency/build/test tooling;
3. create framework code and storage;
4. create collection, dataset, retrieval, training, evaluation, registry, health, recovery, and lifecycle tools;
5. create framework tests;
6. capture initial repository/runtime state;
7. establish deterministic retrieval and recovery baselines;
8. run smoke tests;
9. record initialization as the first framework event.

Integrate with equivalent existing infrastructure instead of duplicating it.

---

# 3. Framework Layout

Keep framework code and state under:

```text
.project-learning/
├── config.json
├── state.json
├── STATUS.md
├── data/
│   ├── learning.db
│   └── exports/
├── framework/
│   ├── bootstrap.py
│   ├── collect.py
│   ├── dataset.py
│   ├── features.py
│   ├── retrieve.py
│   ├── train.py
│   ├── evaluate.py
│   ├── registry.py
│   ├── health.py
│   ├── recover.py
│   ├── lifecycle.py
│   └── common.py
├── models/
│   ├── registry.json
│   ├── champion/
│   └── challengers/
├── evals/
├── experiments/
│   └── registry.jsonl
├── memory/
│   ├── index.json
│   └── chunks.jsonl
├── runtime/
│   ├── context.json
│   ├── health.json
│   └── recovery.json
└── tests/
```

Adapt filenames when necessary while preserving responsibilities.

Project-specific learning belongs under `.project-learning/`, not in root `AGENTS.md`.

---

# 4. Runtime and Dependencies

Prefer isolated Python framework tooling.

Keep framework dependencies separate from application dependencies.

Use the lightest sufficient progression:

1. Python standard library + SQLite;
2. `numpy` / `scikit-learn`;
3. embeddings or model runtimes when evaluation justifies them;
4. heavier deep learning only for measured needs.

For long-running local services, create adapters for availability, timeout, health, progress, version, and telemetry.

Do not introduce a heavy dependency before a simpler baseline exists.

If a dependency is unavailable, keep the framework functional at the highest available stage and record the limitation.

---

# 5. Canonical Data Store

Use `.project-learning/data/learning.db` as canonical structured storage.

Include tables equivalent to:

## tasks
- task_id
- timestamp
- request_text
- task_type
- status
- verification_summary
- repository_revision
- lifecycle_run_id

## task_files
- task_id
- file_path
- relationship
- inspected
- modified
- verified_relevant
- discovery_source
- retrieved_rank

## observations / outcomes
Store task-linked observations, evidence, confidence, result, success, metrics, limitations, and timestamps.

## memory_chunks
Store chunk ID, source, topic, content, confidence, active/stale state, evidence revision, validity revisions, and timestamps.

## failures
Store failure ID, task/incident linkage, category, symptom, cause/hypothesis, fix, verification, and status.

## recovery_incidents
Store:
- incident_id
- started_at / resolved_at
- component
- failure_signature
- severity
- state_before / state_after
- root_cause / confidence
- resolution_status
- repository_revision

## recovery_attempts
Store:
- attempt_id
- incident_id
- attempt_number
- action
- action_source
- reason
- result
- duration
- verification
- side_effects
- timestamp

## decisions / experiments / evaluations / models
Store sufficient provenance, versions, configurations, metrics, status, artifact paths, and timestamps to reproduce decisions and model promotion.

Use versioned schema migrations.

Do not place large source files or raw logs directly in the database.

---

# 6. Evidence Collection

Record useful evidence from completed work and runtime behavior.

Task evidence may include:

- request/category;
- files inspected, modified, and confirmed relevant;
- commands;
- tests/checks;
- observations;
- failures and fixes;
- outcome;
- metrics;
- limitations.

Runtime evidence may include:

- component health;
- heartbeat/progress;
- errors;
- request/inference latency;
- timeouts;
- queue/task progress;
- restart count;
- model/config/version;
- last successful operation;
- resource pressure when available.

Do not store secrets, credentials, tokens, private keys, or unnecessary conversation content.

---

# 7. Labels, Provenance, and Exposure

Derive labels only from defensible evidence.

For file relevance, track discovery source:

```text
user_provided
repository_search
dependency_graph
test_failure
lexical_baseline
model_retrieval
independent_agent_discovery
```

Do not treat exposure as relevance.

For memory relevance, use:

```text
0 = irrelevant or misleading
1 = related but not useful
2 = useful
3 = directly contributed to a verified result
```

Store relevance source, retriever exposure/rank/version, and whether the result was independently verified.

For recovery learning, store failure state, action, action source, reason, outcome, recovery time, side effects, and verification.

Track label provenance, confidence, and repository revision.

---

# 8. Deterministic Baselines

Every learned objective must retain a simpler reproducible baseline.

## Context Retrieval
Use lexical/token/path/symbol retrieval, TF-IDF, recency, and confidence.

## Relevant Files
Use paths, symbols, dependency relationships, and task history.

## Failure Risk
Use historical frequencies and subsystem history.

## Recovery
Use an explicit recovery ladder ordered by safety, reversibility, and evidence.

Learned recovery may rank allowed actions; deterministic guardrails decide which actions are permitted.

---

# 9. Dataset Construction

Build versioned datasets from canonical storage.

Record dataset ID, objective, included records, repository revision range, label/feature rules, exclusions, split strategy, seed when applicable, and duplicate policy.

Prefer chronological splits:

```text
older evidence → training
newer evidence → validation/test
```

Historical examples must not use future outcomes or future memory.

Never evaluate on training examples.

Eligibility must consider diversity as well as count, including task/failure families, repository revisions, class coverage, positive/negative coverage, duplicate fraction, and evaluation count.

---

# 10. ML Objectives

Priority objectives:

1. context retrieval/ranking;
2. relevant-file prediction;
3. task classification;
4. failure-risk prediction;
5. strategy ranking;
6. failure-state classification;
7. recovery-action ranking;
8. stall-risk prediction.

Activate an objective only when usable data and evaluation targets exist.

Recovery models may recommend/rank actions but may not bypass safety policy.

---

# 11. Training Progression

Prefer the simplest model that improves measured performance.

## Retrieval
1. lexical baseline;
2. TF-IDF / nearest neighbor;
3. embeddings;
4. learned reranker.

## Classification / Prediction
1. rules/frequency baseline;
2. logistic regression / linear SVM;
3. tree model;
4. more complex model only if justified.

## Recovery
1. deterministic recovery ladder;
2. historical success-rate ranking;
3. contextual classifier/ranker;
4. more advanced methods only when justified.

Do not use reinforcement learning for recovery until actions are bounded, destructive actions are excluded, offline evaluation exists, rollback works, sufficient incidents exist, and a reliable deterministic fallback remains available.

---

# 12. Automatic Training Eligibility

Store thresholds and resource limits in `config.json`.

Example defaults:

```json
{
  "lifecycle": {
    "reevaluate_every_new_tasks": 10,
    "min_tasks_for_tfidf": 10,
    "min_tasks_for_supervised_model": 30,
    "min_recovery_incidents_for_ranking": 20,
    "min_positive_examples_per_class": 5,
    "min_distinct_task_families": 3,
    "max_near_duplicate_fraction": 0.25
  },
  "resources": {
    "allow_dependency_install": false,
    "allow_network": false,
    "max_training_seconds": 300
  },
  "recovery": {
    "max_attempts_per_incident": 5,
    "max_same_action_repeats": 2
  }
}
```

At task completion and after recovery incidents, check sample count, label quality, diversity, class coverage, repository changes, drift, evaluation staleness, and resource policy.

If eligible and permitted, build a dataset, train a challenger, evaluate it, compare it with baseline/champion, and record the decision.

If work exceeds policy, record it as pending rather than blocking normal application work.

---

# 13. Evaluation and Promotion

Use objective-appropriate metrics.

## Retrieval
- Recall@K
- MRR
- nDCG@K
- Precision@K

## Classification
- macro F1
- per-class precision/recall
- confusion matrix
- calibration when probabilities matter

## Recovery
- recovery success rate
- time to recovery
- attempts to recovery
- repeated-action rate
- regression rate
- fallback/rollback rate
- unsafe-action rejection rate
- unresolved incident rate

Also monitor operational utility such as stale-context rate, repeated-error rate, unnecessary file inspection, latency, context size, and framework overhead.

Promotion must use held-out evidence and account for uncertainty.

Prefer paired evaluation and paired bootstrap/resampling when enough examples exist.

Example configuration:

```json
{
  "promotion": {
    "min_absolute_improvement": 0.01,
    "confidence_level": 0.95,
    "bootstrap_samples": 2000,
    "max_secondary_regression": 0.02
  }
}
```

A tiny numerical win is insufficient.

When evidence is too small or unstable, keep the challenger unpromoted and mark the result exploratory.

---

# 14. Champion / Challenger Registry

Maintain `.project-learning/models/registry.json`.

Track for each objective:

- deterministic baseline;
- current champion;
- challengers;
- dataset/evaluation versions;
- metrics;
- artifact paths;
- creation/promotion dates;
- rollback target.

Promote only when:

1. held-out evaluation exists;
2. challenger beats baseline;
3. minimum improvement is met;
4. uncertainty supports improvement/non-regression;
5. secondary and operational metrics remain within tolerance;
6. coverage/diversity are sufficient;
7. stochastic results are reproducible;
8. no leakage/provenance defect exists.

Recovery champions additionally require no safety-policy violation, no unacceptable increase in unresolved incidents/regressions, and a working deterministic fallback.

Promotion must be atomic and rollbackable.

---

# 15. Context Retrieval and Memory

Before coding work, write `.project-learning/runtime/context.json` with:

- task;
- repository revision;
- relevant memory;
- likely files;
- known failures;
- unresolved recovery incidents;
- related decisions;
- similar tasks;
- retriever versions;
- confidence.

Use champions when available and deterministic baselines otherwise.

Predictions are advisory until verified.

Maintain concise active memory for architecture, behavior, commands, invariants, conventions, recurring failures, verified fixes, recovery patterns, decisions, constraints, dependency quirks, and file relationships.

Each memory item must retain provenance, confidence, revision validity, active/stale status, and last verification.

---

# 16. Health Model

Maintain `.project-learning/runtime/health.json`.

Use states equivalent to:

```text
HEALTHY
DEGRADED
STALLED
RECOVERING
FAILED_SAFE
UNKNOWN
```

Health transitions must be evidence-based.

Signals may include:

- missing heartbeat/progress;
- repeated identical errors;
- repeated identical action/result cycles;
- operation/inference timeout;
- queue or task not advancing;
- repeated training/evaluation failure;
- unavailable process/service;
- missing model/config artifact;
- database/registry inconsistency;
- error-rate spike;
- repeated restart;
- last-success age beyond threshold.

Configure thresholds rather than hard-coding assumptions.

One slow operation is not sufficient evidence of a stall.

---

# 17. Stuck Detection

A system is potentially stalled when configured evidence persists beyond threshold.

Create a failure signature from available evidence:

- component;
- error category/status;
- recent action/result sequence;
- model/configuration version;
- repository revision;
- relevant health signals.

Before recovery:

1. create or resume a recovery incident;
2. snapshot relevant state/config metadata;
3. preserve evidence/log references;
4. identify the last known good state when available;
5. preserve canonical data.

Do not erase evidence during recovery.

Detection itself must not trigger recursive or infinite recovery loops.

---

# 18. Recovery Ladder

Recovery actions must be bounded, reversible where possible, and ordered from least disruptive to most disruptive.

Default ladder:

1. re-check health and confirm the failure persists;
2. retry transient work with bounded backoff/jitter;
3. reset only transient request/task state;
4. restart the failing component or local service;
5. rebuild derived/transient state from canonical data;
6. fall back from challenger to champion;
7. fall back from champion to deterministic baseline;
8. roll back the most recent model/config/checkpoint when evidence points to it;
9. isolate the failing optional subsystem and enter degraded mode;
10. create a code-repair incident with reproduction evidence;
11. diagnose, patch, and regression-test a verified code defect;
12. enter `FAILED_SAFE` when bounded recovery is exhausted.

Never:

- retry forever;
- repeat the same failed action beyond configured limits;
- delete canonical data as a shortcut;
- overwrite a known-good checkpoint before verification;
- silently discard incident history;
- perform irreversible recovery without an explicit safety rule.

The objective is a verified stable state, not endless activity.

---

# 19. Recovery Learning

Every resolved or unresolved incident is learning data.

Record:

- failure signature;
- root cause or hypothesis/confidence;
- actions attempted in order;
- action source: deterministic/model/agent/user;
- outcome of every action;
- final resolution;
- recovery time;
- verification;
- side effects/regressions;
- recurrence.

Use recovery history to improve:

- failure classification;
- likely root-cause ranking;
- recovery-action ranking;
- stall-risk prediction;
- early-warning thresholds.

A learned action recommendation must always pass deterministic validation for permission, reversibility, retry limits, prior failures, canonical-data risk, and required approval.

A single successful recovery is evidence, not a permanent rule.

---

# 20. Code Repair Integration

When an incident indicates a probable code defect:

1. preserve reproduction evidence;
2. identify the smallest affected subsystem;
3. retrieve related failures and previous repairs;
4. reproduce with a targeted test/scenario when practical;
5. establish root cause;
6. make the smallest reasonable patch;
7. add regression coverage when practical;
8. verify the original failure;
9. run relevant surrounding checks;
10. record the repair as incident/training evidence.

Do not blindly repeat a previous repair that failed or regressed.

---

# 21. Experiments and Self-Improvement

Every framework experiment must record:

- experiment ID;
- hypothesis/objective;
- baseline/challenger;
- dataset version;
- feature/model/policy configuration;
- seed when applicable;
- metrics;
- result;
- limitations;
- decision.

Keep failed experiments.

When evidence suggests a better representation, feature, model, retrieval method, labeling rule, recovery policy, threshold, or evaluation method:

1. preserve the current baseline/champion;
2. create and implement a challenger;
3. evaluate on held-out evidence;
4. promote only if better;
5. record the result;
6. keep rollback possible.

Do not adopt complexity merely because it exists.

---

# 22. Drift and Post-Promotion Monitoring

Monitor:

- tasks/incidents since promotion;
- post-promotion utility;
- stale-context rate;
- recovery success and time;
- repeated failure signatures;
- feature/label distribution drift;
- repository path/symbol churn;
- dependency/runtime changes.

Trigger reevaluation after configured intervals, material repository changes, sharp utility regressions, repeated new failure signatures, or recovery degradation.

Automatically demote/rollback a champion when guardrails fail and evidence is sufficient.

---

# 23. Development Learning

All development activity may create learning data.

## Review
Record verified defects, architecture findings, dangerous patterns, missing tests, and invariants.

## Debugging
Record symptom, root cause, failed hypotheses, successful fix, verification, and subsystem.

## Feature Work
Record affected subsystems, architecture changes, tests, commands, decisions, and outcome.

## Refactoring
Record moved responsibilities, changed relationships, retired memory, preserved behavior, and verification.

Store concise structured evidence rather than whole conversations.

---

# 24. Framework Tests

Test at least:

- database creation/migration;
- collection;
- dataset construction/splitting;
- retrieval baselines;
- feature generation;
- model save/load;
- evaluation;
- registry promotion/rollback;
- context generation;
- health transitions;
- stall detection;
- bounded retries;
- recovery ladder ordering;
- recovery idempotency;
- stale-memory handling;
- lifecycle eligibility.

Training and recovery logic must be smoke-testable using synthetic fixtures.

---

# 25. Reproducibility, Atomicity, and Concurrency

Record framework/config/dataset/feature/model versions, repository revision ranges, seeds, evaluation splits, metrics, and artifact hashes where useful.

Every lifecycle/recovery execution must have a unique run ID.

Use SQLite transactions for canonical state.

Use temporary file + atomic rename for registries/state where supported.

Lifecycle and recovery operations must be idempotent.

Concurrent agents must use transactions and a repository-local lock for shared mutations.

A crash must not duplicate tasks, incidents, experiments, evaluations, or promotions.

Model promotion sequence should be:

```text
write immutable challenger
→ hash artifact
→ persist evaluation
→ mark eligible
→ atomically update champion pointer
→ record promotion
```

---

# 26. Data Quality and Governance

Before training:

- remove invalid records;
- detect duplicates/near-duplicates;
- validate labels;
- preserve chronological/revision boundaries;
- prevent future-outcome leakage;
- prevent train/eval overlap;
- record weak labels and model exposure;
- distinguish independent evidence from model-suggested evidence.

Never store secrets, credentials, tokens, private keys, or unnecessary conversation content.

Support deletion/redaction and invalidate or rebuild derived artifacts when provenance requires it.

---

# 27. Performance and Resource Policy

Track when useful:

- retrieval latency;
- training time;
- recovery time;
- model/context/database size;
- index build time;
- restart frequency.

Respect configured CPU, GPU, elapsed-time, storage, network, API-cost, dependency-installation, and recovery limits.

Do not launch expensive work solely because a count threshold was crossed.

Prefer incremental updates.

---

# 28. Persistence

Keep lightweight framework code, schema, configuration, memory metadata, experiment/recovery records, evaluation definitions, and small artifacts versioned when practical.

Do not ignore the entire `.project-learning/` directory.

Large caches, temporary indexes, raw logs, generated datasets, or model binaries may be ignored when sufficient rebuild metadata exists.

---

# 29. Root AGENTS.md Stability

Treat root `AGENTS.md` as the stable framework specification.

Project-specific state belongs under `.project-learning/`.

Modify root `AGENTS.md` only when the framework specification or repository-wide operating rules require it.

---

# 30. Markdown Size Policy

No Markdown file created or materially maintained by this framework may exceed:

```text
32 KiB = 32768 bytes
```

Use actual encoded byte size.

Treat:

```text
28 KiB = 28672 bytes
```

as the soft limit.

When a Markdown file approaches the soft limit:

1. split details into focused files;
2. keep the original as a concise index/summary;
3. link to split files;
4. verify every resulting Markdown file remains below 32 KiB.

Use SQLite/JSON/JSONL/CSV for growing machine data.

---

# 31. STATUS.md

Maintain `.project-learning/STATUS.md` with:

- initialization/schema version;
- current health;
- unresolved recovery incidents;
- completed tasks;
- usable training/recovery examples;
- active objectives;
- champions;
- last training/evaluation;
- next lifecycle threshold;
- pending lifecycle work;
- drift status;
- known limitations.

Keep detailed truth in canonical machine-readable storage.

---

# 32. Lifecycle Command

Create one entry point:

```text
python .project-learning/framework/lifecycle.py
```

Support operations equivalent to:

```text
bootstrap
pre-task
post-task
health
detect-stall
recover
recovery-status
train
evaluate
status
rebuild-memory
rollback
```

Before each task:

1. check framework health and unresolved incidents;
2. record task start;
3. retrieve learned context;
4. inspect current repository/runtime evidence;
5. stabilize critical unhealthy state if required;
6. perform the task.

After each task:

1. record evidence, verification, and outcome;
2. update memory and health;
3. close the task record;
4. check dataset/recovery eligibility;
5. run permitted lifecycle work or mark pending;
6. evaluate/promote/reject challengers;
7. run drift/recovery checks;
8. update `STATUS.md`.

---

# 33. Failure Handling and Completion

The framework must fail safe.

If framework execution fails:

1. preserve application work and canonical data;
2. record the error;
3. fall back to deterministic retrieval/recovery;
4. isolate corrupted derived artifacts;
5. rebuild from canonical state when practical;
6. restore known-good registry/model state when necessary.

Never let framework failure create an infinite self-repair loop.

A task is complete when applicable work and verification are complete, useful evidence is recorded, stale memory is corrected, health/recovery state is updated, eligible lifecycle work ran or is pending, promotion/recovery decisions are recorded, and changed Markdown files remain under 32 KiB.

Do not fabricate learning events.

---

# 34. Guiding Principle

Every task and failure should make the system better informed.

Every trained model must have a baseline.

Every promoted model must earn promotion.

Every recovery action must be bounded and safety-checked.

Every unresolved failure must leave useful evidence.

Every successful recovery should become reusable knowledge.

**Observe → Detect → Recover → Verify → Learn → Train → Evaluate → Improve → Repeat.**
