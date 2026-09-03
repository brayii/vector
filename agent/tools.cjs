const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const IGNORED_DIRECTORIES = new Set(['.git', '.next', '.vinext', '.wrangler', 'dist', 'node_modules', '__pycache__']);
const TEXT_EXTENSIONS = new Set(['.c','.cc','.cpp','.cs','.css','.csv','.go','.h','.hpp','.html','.ini','.java','.js','.json','.jsonl','.jsx','.md','.mts','.php','.ps1','.py','.rb','.rs','.sh','.sql','.toml','.ts','.tsx','.txt','.xml','.yaml','.yml']);
const GIT_ACTIONS = new Set(['diff', 'log', 'show', 'status']);
const NPM_ACTIONS = new Set(['test', 'run']);
const NPM_RUN_ACTIONS = new Set(['build', 'lint', 'test', 'format']);
const NPX_TOOLS = new Set(['tsc', 'oxlint', 'oxfmt']);

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function canonicalExisting(value) {
  return fs.realpathSync.native(path.resolve(value));
}

function resolveWorkspace(target, config) {
  const requested = target ? path.resolve(String(target)) : config.projectRoot;
  if (!fs.existsSync(requested) || !fs.statSync(requested).isDirectory()) throw new Error(`Project directory does not exist: ${requested}`);
  const workspace = canonicalExisting(requested);
  const allowed = config.allowedProjectRoots.filter((root) => fs.existsSync(root)).map(canonicalExisting).some((root) => isWithin(root, workspace));
  if (!allowed) throw new Error('Project is outside VECTOR_ALLOWED_PROJECT_ROOTS.');
  return {
    root: workspace,
    agents: fs.existsSync(path.join(workspace, 'AGENTS.md')),
    learning: fs.existsSync(path.join(workspace, '.project-learning')),
    tooling: {
      node: fs.existsSync(path.join(workspace, 'package.json')),
      python: fs.existsSync(path.join(workspace, 'pyproject.toml')) || fs.existsSync(path.join(workspace, 'requirements.txt')) || fs.existsSync(path.join(workspace, '.project-learning', 'framework', 'lifecycle.py')),
      git: fs.existsSync(path.join(workspace, '.git')),
    },
  };
}

function resolveWorkspacePath(workspace, relativePath, forCreate = false) {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error('Tool paths must be relative to the active project.');
  const candidate = path.resolve(workspace.root, relativePath);
  if (!isWithin(workspace.root, candidate)) throw new Error('Path traversal outside the active project is not allowed.');
  if (forCreate) {
    const parent = canonicalExisting(path.dirname(candidate));
    if (!isWithin(workspace.root, parent)) throw new Error('The destination resolves outside the active project.');
    return candidate;
  }
  const canonical = canonicalExisting(candidate);
  if (!isWithin(workspace.root, canonical)) throw new Error('The path resolves outside the active project.');
  return canonical;
}

function walk(root, config, relative = '', output = []) {
  if (output.length >= config.maxSearchFiles) return output;
  const directory = path.join(root, relative);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const item = path.join(relative, entry.name);
    if (entry.isDirectory()) walk(root, config, item, output);
    else if (entry.isFile()) output.push(item.split(path.sep).join('/'));
    if (output.length >= config.maxSearchFiles) break;
  }
  return output;
}

function listFiles(workspace, args, config) {
  const base = args.path ? resolveWorkspacePath(workspace, args.path) : workspace.root;
  if (!fs.statSync(base).isDirectory()) throw new Error('list_files path must be a directory.');
  const relative = path.relative(workspace.root, base);
  return { files: walk(workspace.root, config, relative).slice(0, Number(args.limit) || 500) };
}

function readFile(workspace, args, config) {
  const file = resolveWorkspacePath(workspace, args.path);
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error('read_file path must be a file.');
  if (stat.size > config.maxReadBytes) throw new Error(`File exceeds ${config.maxReadBytes} byte read limit.`);
  if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()) && !['AGENTS.md','Dockerfile','Makefile'].includes(path.basename(file))) throw new Error('read_file supports text source and configuration files only.');
  return { path: path.relative(workspace.root, file).split(path.sep).join('/'), content: fs.readFileSync(file, 'utf8') };
}

function inspectLearning(workspace) {
  const databasePath = resolveWorkspacePath(workspace,'.project-learning/data/learning.db');
  const database = new DatabaseSync(databasePath,{readOnly:true});
  try {
    const taskStatus = database.prepare('SELECT status, COUNT(*) AS count FROM tasks GROUP BY status').all();
    const openFailures = database.prepare("SELECT category, symptom, status FROM failures WHERE status != 'resolved' ORDER BY rowid DESC LIMIT 20").all();
    const incidents = database.prepare("SELECT incident_id, component, severity, resolution_status FROM recovery_incidents WHERE resolution_status != 'resolved' ORDER BY started_at DESC LIMIT 20").all();
    return { taskStatus, openFailures, unresolvedRecoveryIncidents:incidents };
  } finally { database.close(); }
}

function searchFiles(workspace, args, config) {
  const query = String(args.query || '');
  if (!query) throw new Error('search_files requires a non-empty query.');
  const matches = [];
  for (const relative of walk(workspace.root, config)) {
    if (!TEXT_EXTENSIONS.has(path.extname(relative).toLowerCase())) continue;
    let content;
    try { content = fs.readFileSync(path.join(workspace.root, relative), 'utf8'); } catch { continue; }
    content.split(/\r?\n/).forEach((line, index) => {
      if (matches.length < 200 && line.toLowerCase().includes(query.toLowerCase())) matches.push({ path: relative, line: index + 1, text: line.slice(0, 500) });
    });
    if (matches.length >= 200) break;
  }
  return { query, matches, truncated: matches.length >= 200 };
}

function validateWrite(file, content, config) {
  const bytes = Buffer.byteLength(content);
  const limit = path.extname(file).toLowerCase() === '.md' ? Math.min(config.maxWriteBytes,32768) : config.maxWriteBytes;
  if (bytes > limit) throw new Error(`Write exceeds the ${limit} byte limit.`);
  return bytes;
}

function createFile(workspace, args, config) {
  const file = resolveWorkspacePath(workspace, args.path, true);
  if (fs.existsSync(file)) throw new Error('File already exists; use edit_file.');
  const content = String(args.content ?? '');
  const bytes = validateWrite(file,content,config);
  fs.writeFileSync(file, content, { encoding:'utf8', flag:'wx' });
  return { path:path.relative(workspace.root,file).split(path.sep).join('/'), created:true, bytes };
}

function editFile(workspace, args, config) {
  const file = resolveWorkspacePath(workspace, args.path);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > config.maxReadBytes) throw new Error('File is not safely editable.');
  const content = fs.readFileSync(file, 'utf8');
  const oldText = String(args.old_text ?? '');
  if (!oldText) throw new Error('edit_file requires non-empty old_text.');
  const first = content.indexOf(oldText);
  if (first < 0) throw new Error('old_text was not found.');
  if (content.indexOf(oldText, first + oldText.length) >= 0) throw new Error('old_text is not unique; provide more context.');
  const updated = content.slice(0, first) + String(args.new_text ?? '') + content.slice(first + oldText.length);
  validateWrite(file,updated,config);
  const temporary = `${file}.vector-${process.pid}.tmp`;
  fs.writeFileSync(temporary, updated, 'utf8');
  fs.renameSync(temporary, file);
  return { path: path.relative(workspace.root, file).split(path.sep).join('/'), edited: true, replacements: 1 };
}

function validateCommand(program, args, workspace, policy = { allowMutations:true }) {
  if (!Array.isArray(args) || args.some((item) => typeof item !== 'string' || /[\r\n\0]/.test(item))) throw new Error('Command arguments must be a safe string array.');
  if (program === 'git' && GIT_ACTIONS.has(args[0])) return;
  if (program === 'npm' && NPM_ACTIONS.has(args[0]) && (args[0] !== 'run' || NPM_RUN_ACTIONS.has(args[1])) && (policy.allowMutations || args[1] !== 'format')) return;
  if (program === 'npx' && NPX_TOOLS.has(args[0]) && !args.some((item) => ['--write','-w'].includes(item))) return;
  if (policy.allowMutations && program === 'node' && args[0] && !args[0].startsWith('-')) { resolveWorkspacePath(workspace,args[0]); return; }
  if (program === 'python' && args[0] && !['-c', '-'].includes(args[0])) {
    if (args[0] === '-m' && args[1] === 'unittest' && !args.slice(2).some((item) => path.isAbsolute(item) || item.split(/[\\/]/).includes('..'))) return;
    if (policy.allowMutations && args[0] !== '-m') { resolveWorkspacePath(workspace,args[0]); return; }
  }
  throw new Error(`Command is not approved: ${program} ${args.join(' ')}`);
}

function spawnCommand(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false, settled = false;
    const append = (current, chunk) => (current + chunk.toString()).slice(-100000);
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    const timer = setTimeout(() => { timedOut = true; child.kill(); setTimeout(() => child.kill('SIGKILL'), 1000).unref(); }, options.timeoutMs);
    child.on('error', (error) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ exitCode: null, stdout, stderr: `${stderr}${error.message}`, timedOut }); } });
    child.on('close', (code) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ exitCode: code, stdout, stderr, timedOut }); } });
  });
}

async function runCommand(workspace, args, config, policy = { allowMutations:true }) {
  const program = String(args.program || '').toLowerCase();
  const commandArgs = args.args ?? [];
  validateCommand(program, commandArgs, workspace, policy);
  const cwd = args.cwd ? resolveWorkspacePath(workspace,args.cwd) : workspace.root;
  if (!fs.statSync(cwd).isDirectory()) throw new Error('Command cwd must be a repository directory.');
  let executable = program, finalArgs = commandArgs;
  if (program === 'python') { executable = process.execPath; finalArgs = [path.join(config.projectRoot, 'scripts', 'run-python.cjs'), ...commandArgs]; }
  else if (process.platform === 'win32' && ['npm', 'npx'].includes(program)) executable = `${program}.cmd`;
  return { program, args: commandArgs, cwd:path.relative(workspace.root,cwd).split(path.sep).join('/') || '.', ...(await spawnCommand(executable, finalArgs, { cwd, timeoutMs: config.toolTimeoutMs })) };
}

async function viewDiff(workspace, args, config) {
  const commandArgs = ['diff', '--no-ext-diff', '--'];
  if (args.path) commandArgs.push(args.path);
  return runCommand(workspace, { program: 'git', args: commandArgs }, config);
}

const TOOL_SCHEMAS = [
  ['list_files','List repository files.',{path:{type:'string'},limit:{type:'integer'}}],
  ['read_file','Read a UTF-8 repository file.',{path:{type:'string'}}],
  ['search_files','Search text across repository files.',{query:{type:'string'}}],
  ['create_file','Create a new UTF-8 repository file.',{path:{type:'string'},content:{type:'string'}}],
  ['edit_file','Replace one unique text block in a repository file.',{path:{type:'string'},old_text:{type:'string'},new_text:{type:'string'}}],
  ['view_diff','Inspect the current Git diff.',{path:{type:'string'}}],
  ['inspect_project','Report the validated project root and detected tooling.',{}],
  ['inspect_learning','Inspect bounded status summaries from the project-learning database.',{}],
  ['run_command','Run an approved development command without a shell.',{program:{type:'string',enum:['git','npm','npx','node','python']},args:{type:'array',items:{type:'string'}},cwd:{type:'string'}}],
].map(([name,description,properties]) => ({ type:'function', function:{ name, description, parameters:{ type:'object', properties, required: ['list_files','view_diff','inspect_project','inspect_learning'].includes(name) ? [] : name === 'run_command' ? ['program','args'] : name === 'search_files' ? ['query'] : name === 'edit_file' ? ['path','old_text','new_text'] : ['path'] } } }));

async function executeTool(name, args, workspace, config, policy = { allowMutations:true }) {
  try {
    if (!policy.allowMutations && ['create_file','edit_file'].includes(name)) throw new Error('This request is read-only; file changes require an explicit request to fix or modify code.');
    const handlers = { list_files:() => listFiles(workspace,args,config), read_file:() => readFile(workspace,args,config), search_files:() => searchFiles(workspace,args,config), create_file:() => createFile(workspace,args,config), edit_file:() => editFile(workspace,args,config), view_diff:() => viewDiff(workspace,args,config), inspect_project:() => workspace, inspect_learning:() => inspectLearning(workspace), run_command:() => runCommand(workspace,args,config,policy) };
    if (!handlers[name]) throw new Error(`Unknown tool: ${name}`);
    return { ok:true, result:await handlers[name](), mutated:['create_file','edit_file'].includes(name) };
  } catch (error) { return { ok:false, error:error instanceof Error ? error.message : String(error), mutated:false }; }
}

module.exports = { TOOL_SCHEMAS, canonicalExisting, executeTool, isWithin, resolveWorkspace, resolveWorkspacePath, spawnCommand, validateCommand };
