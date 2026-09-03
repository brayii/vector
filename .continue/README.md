# Continue setup for Vector

This directory supplies project rules and a workspace-local Ollama model block
to the Continue extension. It contains no secrets and is safe to clone.

## One-time setup

1. Install the recommended `Continue - open-source AI code agent` extension in
   VS Code when the workspace recommendation appears.
2. Start Ollama and install the configured model:

   ```powershell
   ollama pull qwen2.5-coder:7b
   ollama create qwen-coder-7b-local -f ollama/VectorCoder.Modelfile
   ```

3. Open Vector's repository root in VS Code and reload the window.
4. Open Continue, select **Vector Qwen2.5-Coder 7B**, and choose Agent mode for coding
   tasks. Continue loads files under `.continue/models` and `.continue/rules`
   automatically for this workspace.

The model endpoint is `http://127.0.0.1:11434`, so prompts and code stay on the
local machine. The configured context target is 24K; reduce it through Vector's
environment configuration if a CPU-only machine lacks sufficient memory.

## Diagnostics

Check that Ollama is available and the exact model tag exists:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

If the model or rules do not appear, run **Developer: Reload Window** in VS Code.
The rule appears in Continue's rules toolbar and applies to Agent, Chat, and Edit
modes; Continue rules do not apply to autocomplete.

The extension itself is not stored in this repository. `.vscode/extensions.json`
only recommends it, so a new machine must accept the recommendation or install
the extension manually.
