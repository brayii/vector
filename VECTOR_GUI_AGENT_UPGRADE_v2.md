# Vector GUI Agent Upgrade Instructions

## Objective

Upgrade Vector's GUI so it is not only a chatbot.

The GUI must use the local **Qwen2.5-Coder 7B** model as Vector's primary reasoning/coding model and allow Vector to answer questions, inspect the repository, modify code, run commands and tests, diagnose and repair its learning framework, and follow the repository's `AGENTS.md` lifecycle.

The implementation must work on both **Windows** and **Linux**.

Do not redesign unrelated parts of the application.

---

# 1. Remove Duplicate Chat Interfaces

The current GUI contains two chat interfaces that perform the same function.

Required changes:

1. Identify both existing chat interfaces.
2. Keep one primary Vector conversation interface.
3. Remove the duplicate chat interface and duplicate state/handlers that exist only to support it.
4. Preserve all useful functionality from both interfaces in the remaining chat.
5. There must be one canonical conversation history and one canonical message submission path.
6. Do not maintain two separate chat backends for the same user-facing Vector conversation.

Expected result:

```text
Vector GUI
    ↓
one chat interface
    ↓
one chat API
    ↓
Vector agent
```

---

# 2. Use Qwen2.5-Coder 7B as Vector's Primary GUI Model

Replace the current GUI model configuration:

```text
gemma3:4b
```

with the locally installed Ollama model:

```text
qwen-coder-7b-local:latest
```

Do not hard-code assumptions about a single operating system.

The GUI backend must verify that Ollama is available and that the configured model exists.

If the 7B model is unavailable, report the problem clearly.

Do not silently fall back to a different model unless an explicit fallback policy is implemented.

---

# 3. Keep Model Configuration Centralized

Do not scatter model names, URLs, context settings, or timeouts throughout the codebase.

Create or use one central configuration location for values equivalent to:

```text
Ollama URL
primary model
fallback model if supported
context length
generation limit
temperature
request timeout
project root
tool permissions
```

Environment-variable overrides may be supported.

Reasonable defaults must work on both Windows and Linux.

---

# 4. Increase Context for Project Work

Configure the 7B model for project-level work.

Target:

```text
context length: 24576
```

If runtime memory pressure makes 24576 impractical, the implementation may safely reduce context while preserving operation.

Do not attempt to place the entire repository in every model request.

Use repository tools and retrieval to load only relevant files and state.

---

# 5. Convert the GUI from Chat-Only to Agent-Capable

The current GUI system prompt explicitly states that Vector does not have general file or terminal access.

That restriction must be replaced with a controlled local agent architecture.

Vector must be capable of using backend tools to:

```text
list files
read files
search files
create files
edit files
inspect diffs
run approved terminal commands
run tests
inspect project-learning state
run project-learning lifecycle commands
```

The model must not merely describe commands that the user should run when Vector has an available tool capable of performing the requested action.

---

# 6. Do Not Give the Browser Raw Shell Access

The browser/frontend must never receive unrestricted direct shell access.

Use this architecture:

```text
Browser GUI
    ↓
Vector local backend
    ↓
validated tool layer
    ↓
repository / terminal / framework
```

All filesystem and process operations must execute on the local backend.

The frontend sends user intent.

The backend decides which validated operation is allowed and executes it.

---

# 7. Repository-Scoped File Tools

Provide backend tools equivalent to:

```text
list_files
read_file
search_files
create_file
edit_file
view_diff
```

Default file access must be restricted to the active project root.

Prevent path traversal outside the permitted workspace unless the user explicitly selects another project and the backend validates that project root.

Normalize paths correctly on Windows and Linux.

Support:

```text
Windows:
C:\path\to\project

Linux:
/home/user/project
```

Do not assume `/` separators or Windows drive letters exclusively.

---

# 8. Terminal Tool

Provide a backend terminal execution tool.

It must:

1. execute commands from the active project directory;
2. capture stdout;
3. capture stderr;
4. capture exit code;
5. enforce a timeout;
6. return structured results to Vector;
7. support Windows and Linux;
8. avoid shell-specific assumptions where possible.

Use platform-aware process execution.

Do not implement command execution by concatenating untrusted strings into a shell command when an argument-array API can be used.

---

# 9. Command Safety

Vector may perform normal development operations such as:

```text
run tests
run linters
run formatters
run build commands
inspect git status
inspect git diff
run Python scripts
run Node scripts
run AGENTS.md lifecycle commands
```

Potentially destructive operations must receive additional validation.

Examples include:

```text
recursive deletion
filesystem operations outside the workspace
force git reset
force push
disk formatting
system shutdown
privilege escalation
mass file replacement
credential manipulation
```

The agent must not be able to bypass backend safety policy through prompting.

---

# 10. Project Target Must Become Real Repository Context

The current project target is primarily a path label.

Upgrade it into an actual validated workspace.

When the user selects or references a project:

1. normalize the path;
2. verify the directory exists;
3. establish it as the active project root;
4. detect `AGENTS.md`;
5. detect `.project-learning/`;
6. detect source/build/test tooling;
7. expose repository-scoped tools for that root.

Do not claim a project has been inspected merely because its path is known.

Actual file/tool evidence is required.

---

# 11. Automatically Load AGENTS.md for Project Actions

When the active repository contains:

```text
AGENTS.md
```

Vector must treat it as repository operating instructions.

For project-changing or project-inspection requests, Vector must consult `AGENTS.md` before acting.

Examples:

```text
review your code
fix your framework
add this feature
debug this failure
run your tests
why are you stuck
why aren't you learning
repair yourself
refactor this code
```

Do not inject an unnecessarily large copy of `AGENTS.md` into every casual conversation.

Load it when repository work requires it.

---

# 12. Integrate the .project-learning Framework

When `.project-learning/` exists, Vector's GUI agent must integrate with it rather than treating it as unrelated files.

Important locations include:

```text
.project-learning/STATUS.md
.project-learning/state.json
.project-learning/config.json
.project-learning/runtime/context.json
.project-learning/runtime/health.json
.project-learning/runtime/recovery.json
.project-learning/framework/
.project-learning/tests/
.project-learning/data/learning.db
.project-learning/models/registry.json
```

Vector must be able to inspect these when relevant.

---

# 13. Support the AGENTS.md Lifecycle

For actionable repository tasks, support the lifecycle defined by `AGENTS.md`.

Conceptual flow:

```text
user request
    ↓
validate active project
    ↓
load AGENTS.md
    ↓
run/check pre-task lifecycle
    ↓
load relevant learned context
    ↓
inspect repository/runtime evidence
    ↓
perform work
    ↓
run verification/tests
    ↓
record task evidence
    ↓
run/check post-task lifecycle
    ↓
update health/status
    ↓
respond with verified result
```

Use the repository lifecycle entry point:

```text
python .project-learning/framework/lifecycle.py
```

Support its existing operations rather than inventing a competing lifecycle.

---

# 14. Framework Self-Repair

Vector must be capable of working on its own framework when requested.

Examples:

```text
"Why aren't you learning?"
"Check your learning framework."
"Fix your recovery system."
"Your lifecycle is failing. Diagnose it."
"Run your tests and repair whatever fails."
```

Vector should be able to inspect relevant framework files, runtime state, logs, tests, database state, and registry state before forming conclusions.

It may modify framework code when the user asks it to fix or improve the framework.

Any repair must follow `AGENTS.md`, preserve evidence, run verification, and avoid fabricating learning events.

---

# 15. Coding Tasks from the GUI

The GUI must support direct coding requests.

Examples:

```text
"Add a feature."
"Fix this bug."
"Refactor this module."
"Create a test."
"Review this repository."
"Find why this API is failing."
"Improve this UI."
```

Vector must be able to:

```text
inspect
search
read
edit
create
run
test
verify
report
```

It should not require the user to switch to Continue merely because the request involves code.

Continue may remain a development tool, but Vector's own GUI must have equivalent controlled project-operation capabilities.

---

# 16. Code Review Behavior

A request such as:

```text
"Do a code review."
```

must trigger an evidence-based repository review.

The agent should:

1. inspect `AGENTS.md`;
2. inspect repository structure;
3. identify relevant application/framework areas;
4. inspect source, configuration, and tests;
5. run appropriate tests/static checks when practical;
6. identify concrete findings;
7. rank findings by severity;
8. cite file paths and relevant symbols/locations;
9. distinguish confirmed defects from risks or suggestions;
10. avoid modifying files unless the user asked for fixes.

---

# 17. Conversation vs Action Behavior

Vector should remain a natural conversational assistant.

Simple questions do not need repository actions.

Examples:

```text
"What does this function do?"
"Explain reinforcement learning."
"How are you doing?"
```

For action-oriented requests, Vector should use tools.

Examples:

```text
"Fix it."
"Run the tests."
"Review your code."
"Update this file."
"Repair your framework."
```

Do not require separate duplicate chat boxes for these behaviors.

One chat should support both conversational and agent behavior.

---

# 18. Tool Execution Feedback

The GUI should visibly distinguish between:

```text
Vector's answer
tool activity
command/test results
errors
```

Do not expose hidden chain-of-thought.

It is acceptable to show concise activity such as:

```text
Reading AGENTS.md
Searching framework files
Running tests
Editing lifecycle.py
Tests passed: 42
```

Do not show private reasoning or internal scratchpad content.

---

# 19. Tool Result Grounding

Vector must never claim that it:

```text
read a file
ran a command
changed code
ran tests
trained a model
repaired the framework
```

unless the backend actually returned evidence that the action occurred.

Tool results are authoritative.

Current repository/runtime evidence overrides stale model assumptions.

---

# 20. Windows and Linux Portability

All new GUI-agent functionality must support both Windows and Linux.

Do not build Linux-only logic into the main agent layer.

Requirements:

1. use Node/Python cross-platform path APIs;
2. use `path.join`, `path.resolve`, or equivalents;
3. handle drive-letter paths on Windows;
4. handle POSIX paths on Linux;
5. avoid hard-coded `/tmp`;
6. avoid hard-coded `/home/...`;
7. avoid assuming PowerShell exists on Linux;
8. avoid assuming Bash exists on Windows;
9. use platform-aware executable lookup;
10. use the current repository's existing portability helpers where practical.

Where platform-specific launch scripts are needed, maintain both:

```text
start-vector.sh
stop-vector.sh

start-vector.ps1
stop-vector.ps1
```

Do not break the existing platform launchers.

---

# 21. Python Portability

The project-learning framework is Python-based.

Do not assume the Python executable is always:

```text
python
```

Support the repository's existing Python-runner strategy.

On different systems the executable may be:

```text
python
python3
py
```

Reuse `scripts/run-python.cjs` or equivalent existing project logic where possible.

---

# 22. Ollama Portability

Assume Ollama is a local service available through:

```text
http://127.0.0.1:11434
```

Do not assume the Ollama executable is installed in one fixed filesystem path.

Check the API before attempting model requests.

The GUI should expose clear status for:

```text
Ollama unavailable
primary model unavailable
model loading
model ready
request timeout
model error
```

---

# 23. Model Status

Update GUI model status so it reports the actual configured model.

Do not leave status logic tied to:

```text
gemma3:4b
```

The GUI should display/report:

```text
qwen-coder-7b-local:latest
```

when that is the configured model.

The readiness check must verify both Ollama and model availability.

Do not require the model to already be loaded into memory merely to consider the system usable; allow Ollama to load it on the first request.

---

# 24. CPU-Only Operation

Vector must continue to work on systems without a GPU.

Do not make CUDA, ROCm, or another GPU runtime mandatory.

The application may detect and report slower CPU-only execution, but CPU-only use must remain supported.

---

# 25. Timeouts for 7B CPU Inference

The current short inference timeout may be inadequate for a 7B model running CPU-only.

Review and adjust timeouts.

The GUI should not fail simply because a valid 7B response takes longer than the previous 4B model.

Use configurable timeouts.

Tool operations and model inference should have separate timeout policies.

---

# 26. Response Length

The current chat response limit is tuned for concise conversation.

For coding/review/framework tasks, Vector may need longer output.

Use task-appropriate response limits.

Do not force every project response into an extremely small generation budget.

Normal conversational responses should remain concise.

---

# 27. Conversation History

Maintain useful recent conversation context without flooding the model.

Preserve:

```text
recent user messages
recent Vector replies
active project
relevant tool results
relevant learned context
```

Do not blindly send full historical conversations.

Repository facts should come from current file/tool/framework evidence whenever practical.

---

# 28. Attachment Support

Preserve existing attachment support.

Attachments must remain user-supplied evidence.

Do not confuse an attachment with repository access.

A repository file should be read through repository tools.

An uploaded document/image should continue to use the existing attachment handling path.

---

# 29. Preserve Portrait and Voice Features

Do not remove unrelated Vector presence features while upgrading the agent.

Preserve working features such as:

```text
Vector portrait
Portrait Workshop
speech output
microphone dictation
browser-local conversation history
attachments
```

Only refactor them when necessary to remove duplicate chat architecture or integrate the unified chat.

---

# 30. Preserve the Impossible Hangar Context

Do not remove the Impossible Hangar requirements or its project-specific knowledge.

However, do not force every unrelated conversation toward the Hangar.

Vector remains a general local companion and development agent.

The Hangar should be used when relevant.

---

# 31. Do Not Replace the Project-Learning Framework with the LLM

The 7B LLM is not the project-learning framework.

Keep the responsibilities separate:

```text
Qwen 7B
    ↓
reasoning / coding / tool selection

.project-learning
    ↓
persistent evidence / datasets / health / recovery / ML lifecycle
```

Vector should use and maintain the framework.

Do not replace deterministic baselines, database state, lifecycle logic, model registry, or recovery logic with LLM conversation memory.

---

# 32. Continue Is Not a Runtime Dependency

Continue proved that `qwen-coder-7b-local` can successfully use agent tools.

Vector's GUI must not require Continue to operate.

Implement the GUI's own local backend tool layer.

Architecture:

```text
Continue
    └── optional development environment

Vector GUI
    └── standalone local agent
        ├── Ollama
        ├── repository tools
        ├── terminal tools
        └── project-learning lifecycle
```

---

# 33. Testing

Add tests for the new agent layer.

At minimum test:

```text
project path normalization
workspace boundary enforcement
file listing
file reading
file search
file creation
file editing
command execution
timeout handling
Windows path handling
Linux path handling
missing Ollama
missing model
model health endpoint
AGENTS.md detection
.project-learning detection
lifecycle command construction
tool result grounding
duplicate chat removal / unified routing
```

Do not depend on a real model response for every unit test.

Mock the Ollama API and tool calls where appropriate.

---

# 34. End-to-End Acceptance Tests

The completed GUI must successfully support workflows equivalent to:

## Conversation

```text
User:
What is reinforcement learning?

Vector:
answers normally
```

## Repository Inspection

```text
User:
Review your learning framework.

Vector:
loads AGENTS.md
inspects framework/state
returns evidence-based findings
```

## Code Review

```text
User:
Do a code review.

Vector:
inspects repository
runs relevant checks
returns ranked findings
does not modify files
```

## Code Change

```text
User:
Add a test for this behavior.

Vector:
finds relevant code
creates/edits test
runs tests
reports verified result
```

## Framework Repair

```text
User:
Why aren't you learning? Find the problem and fix it.

Vector:
inspects lifecycle/health/recovery/database evidence
identifies a defensible problem
repairs it when appropriate
runs verification
updates framework lifecycle evidence
reports result
```

## Terminal Task

```text
User:
Run your tests.

Vector:
executes the appropriate repository test command
reports exit status and failures/success
```

---

# 35. Completion Criteria

This work is complete when:

1. only one Vector chat interface remains;
2. the GUI uses `qwen-coder-7b-local:latest` as its primary local model;
3. conversational chat still works;
4. Vector can inspect the active repository;
5. Vector can read/search/create/edit repository files;
6. Vector can run controlled terminal commands;
7. Vector can run project tests;
8. Vector can perform evidence-based code review;
9. Vector can diagnose and repair `.project-learning` when requested;
10. Vector follows `AGENTS.md` for repository work;
11. Vector does not claim actions without tool evidence;
12. the browser has no unrestricted raw shell access;
13. the implementation works on Windows and Linux;
14. existing portrait, speech, attachment, and Hangar features remain functional;
15. relevant tests pass;
16. the application can run independently of Continue.

---

# Required Final Architecture

```text
                         ┌───────────────────────┐
                         │      Vector GUI       │
                         │   one unified chat    │
                         └───────────┬───────────┘
                                     │
                         ┌───────────▼───────────┐
                         │  Local Agent Backend  │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
             Qwen2.5-Coder 7B   Repository Tools   Terminal Tools
                    │                │                │
                    └────────────────┼────────────────┘
                                     │
                              active project
                                     │
                  ┌──────────────────┼──────────────────┐
                  ▼                  ▼                  ▼
              AGENTS.md        application code    .project-learning
                                                        │
                                                        ▼
                                               persistent learning,
                                               health, recovery,
                                               training/evaluation
```

Vector must be able to **talk, inspect, act, verify, learn, and recover** through one GUI while remaining a controlled local application on both Windows and Linux.

---

# 36. Calm Failure and Recovery Behavior

Vector must not "panic" when something fails, becomes unavailable, or produces an unexpected result.

The standalone GUI must behave like a stable local application.

Required behavior:

1. Do not produce alarmist, frantic, repetitive, or escalating responses because a command, model request, test, lifecycle step, or tool fails.
2. Do not enter recursive retry loops.
3. Do not repeatedly attempt the same failed action beyond configured recovery limits.
4. Do not treat one slow response, one failed command, or one unavailable optional component as catastrophic.
5. Preserve the user's current work and conversation state whenever practical.
6. Report failures plainly and concisely.
7. Use the recovery rules in `AGENTS.md` when repository/framework recovery is appropriate.
8. Fall back to a safe degraded state when recovery is not immediately possible.
9. Never fabricate success simply to avoid reporting an error.
10. Never flood the chat with internal health/recovery messages.

Expected behavior:

```text
Something failed
    ↓
confirm the failure
    ↓
preserve current state
    ↓
attempt bounded safe recovery when appropriate
    ↓
verify
    ↓
continue normally or report the remaining limitation
```

Vector should remain calm and usable even when:

```text
Ollama is unavailable
the 7B model is not loaded
a model request times out
a test fails
a command exits with an error
a file cannot be read
the learning framework is degraded
a recovery attempt fails
an optional subsystem is unavailable
```

Examples of acceptable user-facing responses:

```text
The test failed in presence/app/api/chat/route.ts. I found the failing check and can inspect it further.
```

```text
Ollama is not responding right now. The GUI is still running, but local model responses are unavailable until the service is restored.
```

Do not behave as if the entire application has failed when only one component has failed.

---

# 37. Standalone GUI Must Remain Standalone

Vector's GUI is a standalone local application.

When Vector is launched as the standalone system, the chatbot must not send, redirect, hand off, or route the user to:

```text
VS Code
Continue
Codex inside VS Code
another IDE
another editor
```

for normal supported work.

The standalone Vector GUI must perform its own supported repository work through its local backend and tool layer.

This includes requests such as:

```text
review your code
read this file
find this bug
fix your framework
write code
create a test
run your tests
inspect your health
repair this failure
refactor this module
add this feature
```

The correct architecture is:

```text
Vector standalone GUI
        ↓
Vector local agent backend
        ↓
Qwen2.5-Coder 7B
        +
repository tools
        +
terminal tools
        +
AGENTS.md lifecycle
```

Not:

```text
Vector GUI
    ↓
"Open VS Code"
    ↓
Continue/Codex
```

VS Code, Continue, Codex, or another IDE may still be used separately by a developer to work on the Vector source code, but they are not runtime dependencies and they are not part of Vector's normal standalone user workflow.

Vector must not tell the user that a supported task "requires VS Code" merely because VS Code was used during development.

If a requested action is outside the standalone application's permissions or capabilities, Vector should state the actual limitation directly instead of redirecting the user to an IDE.

Examples:

```text
Allowed:
"I can inspect and edit that file through the local project tools."
```

```text
Allowed:
"That operation is outside the currently authorized project root."
```

```text
Not allowed:
"Open VS Code and use Continue to fix this."
```

```text
Not allowed:
"You need to switch to Codex in VS Code for me to edit my framework."
```

The standalone application must be self-contained for the capabilities defined in this specification.

---

# 38. Standalone Identity and Runtime Boundaries

Vector should understand the difference between:

```text
development environment
```

and:

```text
standalone runtime
```

When running standalone:

- the GUI is Vector's primary user interface;
- Ollama provides the local reasoning model;
- the local backend provides tools;
- the active repository provides project context;
- `AGENTS.md` provides repository operating rules;
- `.project-learning/` provides persistent learning/recovery state.

Do not expose development-only assumptions to the user.

Do not mention VS Code, Continue, Codex, or development setup unless the user explicitly asks about them or the information is directly relevant to a development task.

The user should be able to launch Vector and interact with it as an independent local system without knowing which development tools were used to build it.
