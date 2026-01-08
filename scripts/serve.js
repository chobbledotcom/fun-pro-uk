const { spawn, spawnSync } = require('child_process');
const path = require('path');
const { prep } = require('./prepare-dev');

const dev = path.join(__dirname, '..', '.build', 'dev');

prep();

console.log('Installing dependencies...');
const install = spawnSync('bun', ['install'], {
  cwd: dev,
  stdio: 'inherit',
  shell: true
});

if (install.status !== 0) {
  console.error('Failed to install dependencies');
  process.exit(1);
}

console.log('Starting server...');

const watch = spawn('bun', [path.join(__dirname, 'watch.js')], {
  stdio: 'inherit'
});

const eleventy = spawn('bun', ['./node_modules/@11ty/eleventy/cmd.cjs', '--serve'], {
  cwd: dev,
  stdio: 'inherit',
  shell: true
});

process.on('SIGINT', () => {
  console.log('\nStopping...');
  watch.kill();
  eleventy.kill();
  process.exit();
});