# Vector Local Presence

Vector's first standalone interface provides an animated portrait, typed conversation, browser speech synthesis, microphone dictation where supported, and device-local conversation history.

On Windows, run it by double-clicking `Start Vector.cmd`. On Debian, run
`./start-vector.sh`. See the root `SETUP.md` for clone and dependency setup.

The conversation layer uses `qwen-coder-7b-local:latest` through Ollama and a
loopback-only local agent backend. The backend provides repository-bound file
tools, approved argument-array commands, project-learning lifecycle integration,
and visible grounded activity. It does not silently fall back to another reasoning
model. `gemma3:4b` remains an optional auxiliary vision model for user-supplied
images and the Portrait Workshop.

Configuration is centralized in `agent/config.cjs` and supports environment
overrides. External project roots must be explicitly listed in the platform path
list variable `VECTOR_ALLOWED_PROJECT_ROOTS`; repository access otherwise remains
inside Vector's own clone.

Microphone and speech availability depend on the browser, operating system, installed voices, and user permission. Typed conversation always remains available.
