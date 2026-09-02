const { spawnSync } = require('node:child_process');

const candidates = process.platform === 'win32'
  ? [['python', []], ['py', ['-3.14']], ['py', ['-3']]]
  : [['python3', []], ['python', []]];

for (const [command, prefix] of candidates) {
  const probe = spawnSync(command, [...prefix, '--version'], { stdio: 'ignore' });
  if (!probe.error && probe.status === 0) {
    const result = spawnSync(command, [...prefix, ...process.argv.slice(2)], {
      stdio: 'inherit',
    });
    if (result.error) {
      console.error(`Unable to run ${command}: ${result.error.message}`);
      process.exit(1);
    }
    process.exit(result.status ?? 1);
  }
}

console.error('Python 3 is required. Install python3 on Debian or Python 3.14 on Windows.');
process.exit(1);
