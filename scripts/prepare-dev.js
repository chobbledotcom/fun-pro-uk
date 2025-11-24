const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { templateRepo, buildDir } = require('./consts');

const root = path.resolve(__dirname, '..');
const build = path.join(root, buildDir);
const template = path.join(build, 'template');
const dev = path.join(build, 'dev');
const localTemplate = path.join(root, '..', 'chobble-template');

const templateExcludes = ['.git', 'node_modules', '*.md', 'test', 'test-*'];
const rootExcludes = ['.git', '*.nix', 'README.md', buildDir, 'scripts', 'node_modules', 'package*.json', 'old_site'];

// Helper function to copy directory recursively, excluding patterns
function copyDirSync(src, dest, excludes = []) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Check exclusions
    const shouldExclude = excludes.some(pattern => {
      if (pattern.startsWith('*')) {
        return entry.name.endsWith(pattern.slice(1));
      }
      if (pattern.endsWith('*')) {
        return entry.name.startsWith(pattern.slice(0, -1));
      }
      return entry.name === pattern;
    });

    if (shouldExclude) continue;

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, excludes);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function prep() {
  console.log('Preparing build...');
  fs.mkdirSync(build, { recursive: true });

  if (fs.existsSync(localTemplate)) {
    console.log('Using local template...');
    if (!fs.existsSync(template)) {
      fs.mkdirSync(template, { recursive: true });
    }
    fs.rmSync(template, { recursive: true, force: true });
    copyDirSync(localTemplate, template, templateExcludes);
  } else if (!fs.existsSync(template)) {
    console.log('Cloning template...');
    execSync(`git clone --depth 1 ${templateRepo} "${template}"`);
  } else {
    console.log('Updating template...');
    execSync('git reset --hard && git pull', { cwd: template });
  }

  fs.rmSync(path.join(template, 'test'), { recursive: true, force: true });

  execSync(`find "${dev}" -type f -name "*.md" -delete 2>/dev/null || true`);

  // Copy template to dev directory (replaces rsync)
  fs.rmSync(dev, { recursive: true, force: true });
  copyDirSync(template, dev, templateExcludes);

  // Copy root content to dev/src (replaces rsync)
  const srcDir = path.join(dev, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  copyDirSync(root, srcDir, rootExcludes);

  sync();

  if (!fs.existsSync(path.join(dev, 'node_modules'))) {
    console.log('Installing dependencies...');
    execSync('npm install', { cwd: dev });
  }

  fs.rmSync(path.join(dev, '_site'), { recursive: true, force: true });
  console.log('Build ready.');
}

function sync() {
  // Copy only specific file types from root to dev/src
  const srcDir = path.join(dev, 'src');
  const extensions = ['.md', '.scss', '.woff', '.woff2'];

  function syncDir(srcPath, destPath) {
    if (!fs.existsSync(srcPath)) return;
    const entries = fs.readdirSync(srcPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullSrc = path.join(srcPath, entry.name);
      const fullDest = path.join(destPath, entry.name);

      // Check root exclusions
      const shouldExclude = rootExcludes.some(pattern => {
        if (pattern.startsWith('*')) {
          return entry.name.endsWith(pattern.slice(1));
        }
        if (pattern.endsWith('*')) {
          return entry.name.startsWith(pattern.slice(0, -1));
        }
        return entry.name === pattern;
      });

      if (shouldExclude) continue;

      if (entry.isDirectory()) {
        syncDir(fullSrc, fullDest);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        fs.mkdirSync(path.dirname(fullDest), { recursive: true });
        fs.copyFileSync(fullSrc, fullDest);
      }
    }
  }

  syncDir(root, srcDir);
}

if (require.main === module) prep();

module.exports = { prep, sync };