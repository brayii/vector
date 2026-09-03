# Vector setup

Vector supports Windows and Debian from the same repository clone. Runtime data
and installed dependencies are rebuilt locally; identity and project-learning
memory remain versioned in Git.

## Debian

Install the prerequisites:

```sh
sudo apt update
sudo apt install -y curl git python3 procps util-linux
```

Install Node.js 24 or newer and npm using your preferred maintained Node.js
distribution. Install Ollama, start it, and pull Vector's conversation model:

```sh
ollama pull gemma3:4b
ollama pull qwen2.5-coder:7b
ollama create qwen-coder-7b-local -f ollama/VectorCoder.Modelfile
```

Then clone and launch:

```sh
git clone https://github.com/brayii/vector.git
cd vector
./start-vector.sh
```

Use `./start-vector.sh --no-browser` for a headless VM and open
`http://127.0.0.1:3000/` inside the VM. Stop the managed service with
`./stop-vector.sh`.

## Windows

Install Node.js 24 or newer, Python 3.14, and Ollama. Pull `gemma3:4b`, then
pull `qwen2.5-coder:7b` and run
`ollama create qwen-coder-7b-local -f ollama/VectorCoder.Modelfile`. Then
double-click `Start Vector.cmd`. Use `Stop Vector.cmd` to stop only the processes
recorded by Vector's launcher.

## Development checks

The npm wrapper selects `python3` on Debian and `python` or `py` on Windows:

```sh
npm test
npm --prefix presence test
npm --prefix presence run build
```

The Linux launcher requires `/proc`, `ps`, and `setsid`, as provided by a normal
Debian system and the packages above. A VirtualBox guest needs sufficient RAM
for Ollama plus the selected 4B model. If the browser interface starts but local
chat is unavailable, verify Ollama with
`curl http://127.0.0.1:11434/api/tags`.

## Local agent configuration

`agent/config.cjs` is the single runtime configuration source. Optional
environment overrides include `VECTOR_OLLAMA_URL`, `VECTOR_PRIMARY_MODEL`,
`VECTOR_VISION_MODEL`, `VECTOR_CONTEXT_LENGTH`, `VECTOR_INFERENCE_TIMEOUT_MS`,
`VECTOR_TOOL_TIMEOUT_MS`, and `VECTOR_ALLOWED_PROJECT_ROOTS`. The allowed-roots
value uses `;` between paths on Windows and `:` on Debian. Defaults keep all
repository tools inside Vector's own clone and bind the agent only to loopback.
