const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config.cjs');
const { TOOL_SCHEMAS, executeTool, resolveWorkspace, spawnCommand } = require('./tools.cjs');

const config = loadConfig();
const ACTION_PATTERN = /^\s*(?:(?:can|could|would)\s+you\s+|please\s+)?(?:add|build|change|check|create|debug|diagnose|do\s+(?:a\s+)?code\s+review|edit|fix|implement|inspect|investigate|refactor|repair|review|run|test|update|write)\b|\bwhy\b.*\b(?:aren't|isn't|not|stuck|failing)\b.*\b(?:learning|framework|lifecycle|recovery)\b/i;
const MUTATION_PATTERN = /\b(add|change|create|edit|fix|implement|modify|patch|refactor|repair|update|write)\b/i;
const MUTATING_TOOLS = new Set(['create_file', 'edit_file']);

function jsonResponse(response, status, body) {
  const data = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Content-Length':Buffer.byteLength(data), 'Cache-Control':'no-store' });
  response.end(data);
}

function readRequest(request, maximum = 70_000_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', (chunk) => { data += chunk; if (data.length > maximum) { reject(new Error('Request is too large.')); request.destroy(); } });
    request.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Request body must be valid JSON.')); } });
    request.on('error', reject);
  });
}

async function ollama(pathname, body, timeoutMs = config.inferenceTimeoutMs, runtimeConfig = config, fetchImpl = fetch) {
  const response = await fetchImpl(`${runtimeConfig.ollamaBaseUrl}${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type':'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Ollama returned HTTP ${response.status}.`);
  return payload;
}

async function modelHealth(runtimeConfig = config, fetchImpl = fetch) {
  try {
    const [tags, running] = await Promise.all([ollama('/api/tags',undefined,runtimeConfig.inferenceTimeoutMs,runtimeConfig,fetchImpl), ollama('/api/ps',undefined,runtimeConfig.inferenceTimeoutMs,runtimeConfig,fetchImpl)]);
    const available = (tags.models || []).some((item) => item.name === runtimeConfig.primaryModel || item.model === runtimeConfig.primaryModel);
    const loaded = (running.models || []).some((item) => item.name === runtimeConfig.primaryModel || item.model === runtimeConfig.primaryModel);
    return { ollama:true, model:runtimeConfig.primaryModel, modelAvailable:available, modelLoaded:loaded, ready:available, state:available ? (loaded ? 'ready' : 'available') : 'model_unavailable' };
  } catch (error) {
    return { ollama:false, model:runtimeConfig.primaryModel, modelAvailable:false, modelLoaded:false, ready:false, state:'ollama_unavailable', error:error instanceof Error ? error.message : String(error) };
  }
}

function lifecycleArguments(workspace, operation, args, runtimeConfig = config) {
  return [path.join(runtimeConfig.projectRoot, 'scripts', 'run-python.cjs'), '.project-learning/framework/lifecycle.py', operation, ...args];
}

async function runLifecycle(workspace, operation, args) {
  if (!workspace.learning) return { skipped:true, reason:'No .project-learning framework in the active project.' };
  return spawnCommand(process.execPath, lifecycleArguments(workspace,operation,args), { cwd:workspace.root, timeoutMs:config.toolTimeoutMs });
}

function conciseResult(value) {
  const text = JSON.stringify(value);
  return text.length > 800 ? `${text.slice(0,800)}…` : text;
}

function instructions(workspace, actionable) {
  let system = `You are Vector, a calm standalone local development agent and companion. Your confirmed visible form is a silver-and-black winged aerospace android with a blue visor; your birthday is August 31, 2026. Answer casual questions naturally and concisely. For repository work, inspect current evidence with tools, act when requested, verify changes, and cite repository-relative paths. A review or diagnosis is read-only unless the user explicitly requests a fix or modification. Never claim a tool action without its returned evidence. Never expose chain-of-thought. Tool failures are local limitations, not catastrophes: report them plainly and do not retry the same failed action repeatedly. The browser has no shell access; only these validated tools operate inside the active project. Never ask the user to switch to an IDE for supported repository work.`;
  if (actionable && workspace.agents) {
    const agents = fs.readFileSync(path.join(workspace.root, 'AGENTS.md'), 'utf8');
    system += `\n\nThe active repository has AGENTS.md. These are authoritative operating instructions for this repository:\n<agents>\n${agents.slice(0,100000)}\n</agents>`;
  }
  if (actionable && workspace.learning) {
    for (const relative of ['.project-learning/STATUS.md','.project-learning/runtime/health.json','.project-learning/runtime/context.json']) {
      try { system += `\n\nCurrent ${relative}:\n${fs.readFileSync(path.join(workspace.root, relative), 'utf8').slice(0,12000)}`; } catch {}
    }
  }
  if (actionable) system += `\n\nValidated active project: ${workspace.root}\nDetected: AGENTS.md=${workspace.agents}, project-learning=${workspace.learning}, tooling=${JSON.stringify(workspace.tooling)}.`;
  return system;
}

async function runAgent(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const latest = [...messages].reverse().find((message) => message.role === 'user');
  if (!latest || !String(latest.text || '').trim()) throw Object.assign(new Error('A user message is required.'), { status:400 });
  const workspace = resolveWorkspace(body.target, config);
  const actionable = ACTION_PATTERN.test(String(latest.text));
  const policy = { allowMutations:MUTATION_PATTERN.test(String(latest.text)) };
  const health = await modelHealth();
  if (!health.ollama) throw Object.assign(new Error('Ollama is not responding. Vector remains available, but local reasoning is unavailable until Ollama is restored.'), { status:503, health });
  if (!health.modelAvailable) throw Object.assign(new Error(`The configured primary model ${config.primaryModel} is not installed in Ollama. No fallback model was used.`), { status:503, health });

  const activity = [];
  let taskId = null;
  if (actionable && workspace.learning) {
    activity.push({ kind:'lifecycle', status:'running', label:'Loading project lifecycle' });
    const lifecycle = await runLifecycle(workspace, 'pre-task', [String(latest.text).slice(0,1000)]);
    if (lifecycle.exitCode !== 0) throw Object.assign(new Error(`The project pre-task lifecycle failed: ${lifecycle.stderr || lifecycle.stdout}`), { status:502, activity });
    try { taskId = JSON.parse(lifecycle.stdout).task_id; } catch { throw Object.assign(new Error('The project lifecycle returned invalid task evidence.'), { status:502, activity }); }
    activity[activity.length - 1] = { kind:'lifecycle', status:'success', label:'Project lifecycle loaded', summary:`Task ${taskId}` };
  }

  try {
  const ollamaMessages = [{ role:'system', content:instructions(workspace, actionable) }];
  for (const message of messages.slice(-6)) {
    const role = message.role === 'vector' ? 'assistant' : message.role === 'user' ? 'user' : null;
    if (role) {
      const priorActivity = Array.isArray(message.activity) ? message.activity.slice(-8).map((item) => `${item.status}: ${item.label}${item.summary ? ` — ${item.summary}` : ''}`).join('\n') : '';
      ollamaMessages.push({ role, content:`${String(message.text || '').slice(0,3000)}${priorActivity ? `\n\nGrounded activity from that response:\n${priorActivity.slice(0,3000)}` : ''}` });
    }
  }
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0,6) : [];
  if (attachments.length) {
    const current = ollamaMessages.at(-1);
    const images = attachments.filter((item) => item.kind === 'image' && item.content).map((item) => item.content);
    let attachmentBudget = 20000;
    current.content += attachments.map((item) => {
      if (item.kind !== 'text') return `\n\nUser attachment: ${item.name} (${item.kind})`;
      const content = String(item.content || '').slice(0,attachmentBudget);
      attachmentBudget -= content.length;
      return `\n\nUser attachment ${item.name}:\n${content}${content.length < String(item.content || '').length ? '\n[truncated to fit project context]' : ''}`;
    }).join('');
    if (images.length) {
      try {
        const visual = await ollama('/api/chat', { model:config.visionModel, stream:false, think:false, messages:[{ role:'user', images, content:'Describe the supplied user images accurately and transcribe visible text. Return observations only.' }], options:{ num_ctx:8192, num_predict:700, temperature:0.1 } }, Math.min(config.inferenceTimeoutMs,120000));
        current.content += `\n\nAuxiliary vision-model observations (user-supplied evidence):\n${String(visual.message?.content || '').slice(0,12000)}`;
        activity.push({ kind:'tool', status:'success', label:'Inspecting attached images', summary:`Processed ${images.length} image attachment(s) with ${config.visionModel}.` });
      } catch (error) {
        current.content += '\n\nThe image attachment could not be inspected by the optional vision model.';
        activity.push({ kind:'tool', status:'error', label:'Inspecting attached images', summary:error instanceof Error ? error.message : String(error) });
      }
    }
  }

  let answer = '';
  let hadFailure = false;
  let hadMutation = false;
  for (let round = 0; round < config.maxToolRounds; round += 1) {
    const availableTools = policy.allowMutations ? TOOL_SCHEMAS : TOOL_SCHEMAS.filter((tool) => !['create_file','edit_file'].includes(tool.function.name));
    const response = await ollama('/api/chat', { model:config.primaryModel, messages:ollamaMessages, tools:actionable ? availableTools : undefined, stream:false, think:false, keep_alive:'10m', options:{ num_ctx:config.contextLength, num_predict:actionable ? config.projectTokens : config.conversationTokens, temperature:config.temperature } });
    const assistant = response.message || {};
    ollamaMessages.push(assistant);
    const calls = assistant.tool_calls || [];
    if (!calls.length) { answer = String(assistant.content || '').trim(); break; }
    for (const call of calls) {
      const name = call.function?.name;
      let args = call.function?.arguments || {};
      if (typeof args === 'string') {
        try { args = JSON.parse(args); } catch { args = {}; }
      }
      activity.push({ kind:'tool', status:'running', label:`Running ${name}` });
      const result = await executeTool(name, args, workspace, config, policy);
      hadFailure ||= !result.ok; hadMutation ||= result.mutated || MUTATING_TOOLS.has(name) && result.ok;
      const commandFailed = name === 'run_command' && result.ok && (result.result.timedOut || result.result.exitCode !== 0);
      activity[activity.length - 1] = { kind:'tool', status:result.ok && !commandFailed ? 'success' : 'error', label:name, summary:conciseResult(result.ok ? result.result : result.error) };
      ollamaMessages.push({ role:'tool', tool_name:name, content:JSON.stringify(result) });
    }
  }
  if (!answer) answer = hadFailure ? 'I could not complete that operation. The tool activity shows the remaining limitation.' : 'I reached the bounded tool-operation limit. Your work is preserved; please narrow the next step.';

  if (taskId) {
    const outcome = hadFailure ? 'fail-task' : 'post-task';
    const summary = hadFailure ? 'Standalone agent task ended with one or more recorded tool failures.' : `Standalone agent completed the requested repository work with ${activity.filter((item) => item.kind === 'tool').length} grounded tool result(s)${hadMutation ? ' and repository changes' : ''}.`;
    const lifecycle = await runLifecycle(workspace, outcome, [taskId, summary]);
    activity.push({ kind:'lifecycle', status:lifecycle.exitCode === 0 ? 'success' : 'error', label:hadFailure ? 'Failure evidence recorded' : 'Project lifecycle completed', summary:(lifecycle.stderr || lifecycle.stdout).slice(0,800) });
  }
  return { answer, model:config.primaryModel, local:true, project:workspace, activity, health };
  } catch (error) {
    if (taskId) {
      const lifecycle = await runLifecycle(workspace,'fail-task',[taskId,`Standalone agent stopped safely: ${error instanceof Error ? error.message : String(error)}`]);
      activity.push({ kind:'lifecycle', status:lifecycle.exitCode === 0 ? 'success' : 'error', label:'Failure evidence recorded', summary:(lifecycle.stderr || lifecycle.stdout).slice(0,800) });
      if (error && typeof error === 'object') error.activity = activity;
      else throw Object.assign(new Error(String(error)),{activity});
    }
    throw error;
  }
}

async function portrait(body) {
  if (!body.image || String(body.image).length > 12_000_000) throw Object.assign(new Error('A portrait image is required.'), { status:400 });
  const payload = await ollama('/api/chat', { model:config.visionModel, stream:false, think:false, format:'json', keep_alive:'5m', messages:[{ role:'user', images:[body.image], content:'Inspect Vector’s portrait and propose one restrained display cleanup using only crop position, scale, brightness, contrast, and saturation. Preserve the original. Return JSON with scale, positionX, positionY, brightness, contrast, saturation, and a one-sentence rationale.' }], options:{ num_ctx:4096, num_predict:180, temperature:0.2 } }, Math.min(config.inferenceTimeoutMs,120000));
  return { raw:payload.message?.content || '{}', model:config.visionModel };
}

const server = http.createServer(async (request, response) => {
  if (request.headers.origin) return jsonResponse(response, 403, { error:'Direct browser access to the agent service is not allowed.' });
  try {
    if (request.method === 'GET' && request.url === '/health') return jsonResponse(response, 200, await modelHealth());
    if (request.method === 'POST' && request.url === '/agent') return jsonResponse(response, 200, await runAgent(await readRequest(request)));
    if (request.method === 'POST' && request.url === '/portrait') return jsonResponse(response, 200, await portrait(await readRequest(request)));
    return jsonResponse(response, 404, { error:'Not found.' });
  } catch (error) {
    return jsonResponse(response, error.status || 500, { error:error instanceof Error ? error.message : String(error), health:error.health, activity:error.activity || [] });
  }
});

if (require.main === module) {
  server.listen(config.port, config.host, () => console.log(`Vector agent listening on http://${config.host}:${config.port}`));
  const shutdown = () => {
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
    setTimeout(() => { server.closeAllConnections?.(); process.exit(0); }, 1000).unref();
  };
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, shutdown);
}

module.exports = { ACTION_PATTERN, MUTATION_PATTERN, instructions, lifecycleArguments, modelHealth, runAgent };
