---
name: Vector Project Lifecycle
alwaysApply: true
description: Required repository workflow for every Vector coding task.
---

# Vector Project Lifecycle

`AGENTS.md` is the authoritative repository instruction file. Read it from the
current workspace before acting; chat history and model memory are not substitutes.

For every coding task:

1. Run `python .project-learning/framework/lifecycle.py pre-task "<task>"`
   before editing. On Windows, use `py -3.14` if `python` is not available.
2. Inspect the returned health, unresolved incidents, learned context, repository
   code, tests, configuration, logs, and runtime evidence relevant to the task.
3. Stabilize a critical unhealthy state before unrelated work.
4. Make the smallest change that satisfies the request and every applicable
   requirement in `AGENTS.md`.
5. Verify the result with focused tests and relevant surrounding checks. Never
   claim a diagnosis, recovery, or improvement without evidence.
6. Run `python .project-learning/framework/lifecycle.py post-task <task-id>
   "<verified result>"` after successful work. If work cannot be completed, use
   an honest failure summary instead of claiming success.
7. Confirm framework health and inspect the resulting Git diff before reporting
   completion.

Do not modify root `AGENTS.md` merely to store task-specific learning. Keep that
state under `.project-learning/`. Do not store credentials, tokens, or private
conversation content in the repository.

If a user request conflicts with `AGENTS.md`, explain the exact conflict before
making the change. If a lifecycle command fails, preserve application work and
canonical data, report the failure, and use the deterministic fallback described
by `AGENTS.md`; do not invent a successful lifecycle event.
