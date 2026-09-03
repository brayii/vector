const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ACTION_PATTERN, MUTATION_PATTERN, instructions, lifecycleArguments, modelHealth } = require('./server.cjs');
const { executeTool, isWithin, resolveWorkspace, resolveWorkspacePath, spawnCommand, validateCommand } = require('./tools.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-agent-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Test instructions\n');
  fs.mkdirSync(path.join(root, '.project-learning'));
  fs.writeFileSync(path.join(root, '.project-learning', 'state.json'), '{}');
  fs.writeFileSync(path.join(root, 'sample.txt'), 'alpha\nbeta\n');
  const config = { projectRoot:root, allowedProjectRoots:[root], maxReadBytes:10000, maxWriteBytes:40000, maxSearchFiles:100, toolTimeoutMs:1000 };
  return { root, config, workspace:resolveWorkspace(root,config) };
}

test('normalizes and validates active workspace with project metadata', () => {
  const { root, workspace } = fixture();
  assert.equal(workspace.root, fs.realpathSync.native(root));
  assert.equal(workspace.agents, true);
  assert.equal(workspace.learning, true);
});

test('enforces workspace boundaries and blocks traversal', () => {
  const { workspace } = fixture();
  assert.throws(() => resolveWorkspacePath(workspace, '../outside.txt', true), /traversal/);
  assert.throws(() => resolveWorkspacePath(workspace, path.resolve(os.tmpdir(), 'outside.txt'), true), /relative/);
  assert.equal(isWithin('C:\\repo', 'C:\\repo-other'), process.platform === 'win32' ? false : true);
  assert.equal(path.win32.normalize('C:/work/vector'), 'C:\\work\\vector');
  assert.equal(path.posix.normalize('/home/user/../user/vector'), '/home/user/vector');
});

test('lists, reads, searches, creates, and edits files with grounded results', async () => {
  const { root, workspace, config } = fixture();
  assert.ok((await executeTool('list_files',{},workspace,config)).result.files.includes('sample.txt'));
  assert.ok((await executeTool('list_files',{},workspace,config)).result.files.includes('.project-learning/state.json'));
  assert.match((await executeTool('read_file',{path:'sample.txt'},workspace,config)).result.content,/alpha/);
  assert.equal((await executeTool('search_files',{query:'beta'},workspace,config)).result.matches[0].line,2);
  assert.equal((await executeTool('create_file',{path:'created.txt',content:'one'},workspace,config)).mutated,true);
  assert.equal((await executeTool('edit_file',{path:'created.txt',old_text:'one',new_text:'two'},workspace,config)).mutated,true);
  const deniedEdit = await executeTool('edit_file',{path:'created.txt',old_text:'two',new_text:'three'},workspace,config,{allowMutations:false});
  assert.equal(deniedEdit.ok,false);
  assert.match(deniedEdit.error,/read-only/);
  assert.equal(fs.readFileSync(path.join(root,'created.txt'),'utf8'),'two');
  assert.equal(fs.readFileSync(path.join(workspace.root,'created.txt'),'utf8'),'two');
  const oversized = await executeTool('create_file',{path:'large.md',content:'x'.repeat(32769)},workspace,config);
  assert.equal(oversized.ok,false); assert.match(oversized.error,/32768 byte limit/);
});

test('approved commands use argument arrays and unsafe commands are rejected', () => {
  const { workspace } = fixture();
  assert.doesNotThrow(() => validateCommand('git',['status','--short'],workspace));
  assert.doesNotThrow(() => validateCommand('npm',['test'],workspace));
  assert.throws(() => validateCommand('git',['reset','--hard'],workspace),/not approved/);
  assert.throws(() => validateCommand('python',['-c','import os'],workspace),/not approved/);
  assert.throws(() => validateCommand('npm',['run','arbitrary'],workspace),/not approved/);
  assert.throws(() => validateCommand('node',['sample.txt'],workspace,{allowMutations:false}),/not approved/);
});

test('command runner captures output, exit code, and timeout', async () => {
  const ok = await spawnCommand(process.execPath,['-e','console.log("ready")'],{cwd:process.cwd(),timeoutMs:1000});
  assert.equal(ok.exitCode,0); assert.match(ok.stdout,/ready/); assert.equal(ok.timedOut,false);
  const slow = await spawnCommand(process.execPath,['-e','setTimeout(()=>{},10000)'],{cwd:process.cwd(),timeoutMs:20});
  assert.equal(slow.timedOut,true);
});

test('model health distinguishes missing Ollama, missing model, and available model', async () => {
  const config = { primaryModel:'qwen-coder-7b-local:latest', ollamaBaseUrl:'http://local', inferenceTimeoutMs:1000 };
  const unavailable = await modelHealth(config, async () => { throw new Error('offline'); });
  assert.equal(unavailable.state,'ollama_unavailable');
  const missing = await modelHealth(config, async (url) => new Response(JSON.stringify({models:[]})));
  assert.equal(missing.state,'model_unavailable'); assert.equal(missing.ollama,true);
  const available = await modelHealth(config, async (url) => new Response(JSON.stringify({models:url.endsWith('/api/tags') ? [{name:config.primaryModel}] : []})));
  assert.equal(available.state,'available'); assert.equal(available.ready,true); assert.equal(available.modelLoaded,false);
});

test('lifecycle construction uses the portable runner and action requests load instructions', () => {
  const { workspace, config } = fixture();
  const args = lifecycleArguments(workspace,'pre-task',['review'],config);
  assert.equal(args[1],'.project-learning/framework/lifecycle.py'); assert.equal(args[2],'pre-task');
  assert.equal(ACTION_PATTERN.test('Review your learning framework'),true);
  assert.equal(ACTION_PATTERN.test('What is reinforcement learning?'),false);
  assert.equal(ACTION_PATTERN.test('Can you review this repository?'),true);
  assert.equal(ACTION_PATTERN.test('Why are you not learning?'),true);
  assert.equal(MUTATION_PATTERN.test('Review your learning framework'),false);
  assert.equal(MUTATION_PATTERN.test('Review and fix your learning framework'),true);
  const system = instructions(workspace,true);
  assert.match(system,/authoritative operating instructions/); assert.match(system,/Never claim a tool action/);
});

test('project and learning inspection return bounded grounded metadata', async () => {
  const root = path.resolve(__dirname,'..');
  const config = { projectRoot:root, allowedProjectRoots:[root], maxReadBytes:200000, maxWriteBytes:200000, maxSearchFiles:2000, toolTimeoutMs:1000 };
  const workspace = resolveWorkspace(root,config);
  const project = await executeTool('inspect_project',{},workspace,config);
  const learning = await executeTool('inspect_learning',{},workspace,config);
  assert.equal(project.ok,true); assert.equal(project.result.agents,true);
  assert.equal(learning.ok,true); assert.ok(Array.isArray(learning.result.taskStatus));
  assert.ok(Array.isArray(learning.result.unresolvedRecoveryIncidents));
});

test('GUI retains one canonical chat route and one submission path', () => {
  const root = path.resolve(__dirname,'..');
  const page = fs.readFileSync(path.join(root,'presence','app','page.tsx'),'utf8');
  assert.equal((page.match(/<form className=/g) || []).length,1);
  assert.equal((page.match(/fetch\('\/api\/chat'/g) || []).length,2); // health GET + canonical POST
  assert.ok(page.indexOf('if (payload.project?.root) setTarget') > page.indexOf('if (!response.ok || !payload.answer)'));
  assert.equal(fs.existsSync(path.join(root,'presence','app','api','chat','route.ts')),true);
});
