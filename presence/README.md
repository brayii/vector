# Vector Local Presence

Vector's first standalone interface provides an animated portrait, typed conversation, browser speech synthesis, microphone dictation where supported, and device-local conversation history.

On Windows, run it by double-clicking `Start Vector.cmd`. On Debian, run
`./start-vector.sh`. See the root `SETUP.md` for clone and dependency setup.

The conversation layer uses the locally installed `gemma3:4b` model through Ollama and falls back to a small deterministic flight-safe responder when the local model is unavailable. Gemma was selected after the installed Qwen model exposed internal draft reasoning instead of a clean answer during verification. Vector does not claim unrestricted computer control. Guarded file and terminal tools belong in a later stage with explicit permission boundaries and measured reliability.

Microphone and speech availability depend on the browser, operating system, installed voices, and user permission. Typed conversation always remains available.
