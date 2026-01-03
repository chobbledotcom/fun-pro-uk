const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { prep } = require('./prepare-dev');

const root = path.resolve(__dirname, '..');
const dev = path.join(root, '.build', 'dev');
const output = path.join(root, '_site');

prep();

console.log('Building site...');

fs.rmSync(output, { recursive: true, force: true });

try {
  execSync('bun ./node_modules/@11ty/eleventy/cmd.cjs', { cwd: dev, stdio: 'inherit' });
} catch (err) {
  // Check if _site was actually created despite the error
  if (!fs.existsSync(path.join(dev, '_site'))) {
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    console.error('Build failed.');
    process.exit(err.status || 1);
  }
  // Otherwise the build succeeded, continue
}

execSync(`mv "${path.join(dev, '_site')}" "${output}"`);

console.log(`✓ Built to _site/`);