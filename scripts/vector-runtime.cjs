const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const presence = path.join(root, 'presence');
const vinext = path.join(presence, 'node_modules', 'vinext', 'dist', 'cli.js');
const children = [
  spawn(process.execPath, [path.join(root, 'agent', 'server.cjs')], { cwd:root, stdio:'inherit', windowsHide:true }),
  spawn(process.execPath, [vinext,'dev','--host','127.0.0.1','--port','3000'], { cwd:presence, stdio:'inherit', windowsHide:true, shell:false }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill();
  setTimeout(() => process.exit(code), 1500).unref();
}
for (const child of children) {
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code, signal) => { if (!stopping) { console.error(`Vector component exited (${code ?? signal}).`); stop(code || 1); } });
}
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => stop(0));
