const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function numberFromEnv(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function loadConfig() {
  const extraRoots = (process.env.VECTOR_ALLOWED_PROJECT_ROOTS || '')
    .split(path.delimiter)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => path.resolve(value));
  return Object.freeze({
    host: '127.0.0.1',
    port: numberFromEnv('VECTOR_AGENT_PORT', 4317, 1024, 65535),
    ollamaBaseUrl: process.env.VECTOR_OLLAMA_URL || 'http://127.0.0.1:11434',
    primaryModel: process.env.VECTOR_PRIMARY_MODEL || 'qwen-coder-7b-local:latest',
    visionModel: process.env.VECTOR_VISION_MODEL || 'gemma3:4b',
    contextLength: numberFromEnv('VECTOR_CONTEXT_LENGTH', 24576, 4096, 65536),
    conversationTokens: numberFromEnv('VECTOR_CONVERSATION_TOKENS', 512, 128, 4096),
    projectTokens: numberFromEnv('VECTOR_PROJECT_TOKENS', 2048, 256, 8192),
    temperature: numberFromEnv('VECTOR_TEMPERATURE', 0.2, 0, 1),
    inferenceTimeoutMs: numberFromEnv('VECTOR_INFERENCE_TIMEOUT_MS', 180000, 10000, 600000),
    toolTimeoutMs: numberFromEnv('VECTOR_TOOL_TIMEOUT_MS', 120000, 1000, 600000),
    maxToolRounds: numberFromEnv('VECTOR_MAX_TOOL_ROUNDS', 8, 1, 16),
    maxReadBytes: numberFromEnv('VECTOR_MAX_READ_BYTES', 200000, 1024, 1000000),
    maxWriteBytes: numberFromEnv('VECTOR_MAX_WRITE_BYTES', 200000, 1024, 1000000),
    maxSearchFiles: numberFromEnv('VECTOR_MAX_SEARCH_FILES', 2000, 10, 20000),
    projectRoot: PROJECT_ROOT,
    allowedProjectRoots: [PROJECT_ROOT, ...extraRoots],
  });
}

module.exports = { loadConfig, PROJECT_ROOT };
