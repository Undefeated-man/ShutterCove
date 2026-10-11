'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function executable() {
  const dist = path.join(root, 'dist');
  if (process.platform === 'linux') {
    const binary = path.join(dist, 'linux-unpacked', 'shiguang-isle');
    fs.accessSync(binary, fs.constants.X_OK);
    return binary;
  }
  if (process.platform !== 'darwin') throw new Error('Packaged smoke supports macOS and Linux');
  const candidates = [];
  for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(dist, entry.name);
    if (entry.name.endsWith('.app')) {
      candidates.push(path.join(directory, 'Contents', 'MacOS', 'Shiguang Isle'));
    } else if (entry.name.startsWith('mac')) {
      for (const bundle of fs.readdirSync(directory, { withFileTypes: true })) {
        if (bundle.isDirectory() && bundle.name.endsWith('.app')) candidates.push(path.join(directory, bundle.name, 'Contents', 'MacOS', 'Shiguang Isle'));
      }
    }
  }
  const available = candidates.filter(file => fs.existsSync(file));
  const nativeFolder = process.arch === 'arm64' ? 'mac-arm64' : 'mac';
  const preferred = available.filter(file => path.basename(path.dirname(path.dirname(path.dirname(path.dirname(file))))) === nativeFolder);
  const selected = preferred.length ? preferred : available;
  if (selected.length !== 1) throw new Error(`Expected one native packaged macOS app, found ${selected.length}`);
  fs.accessSync(selected[0], fs.constants.X_OK);
  return selected[0];
}

function launch(binary, args) {
  const linux = process.platform === 'linux';
  const command = linux ? 'xvfb-run' : binary;
  const parameters = linux ? ['-a', binary, '--no-sandbox', ...args] : args;
  const result = spawnSync(command, parameters, { cwd: root, stdio: 'inherit', timeout: 180_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Packaged smoke failed: exit ${result.status}, signal ${result.signal || 'none'}`);
}

async function main() {
  const binary = executable();
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shiguang-package-smoke-')));
  try {
    const photos = path.join(temporary, 'photos');
    const output = path.join(temporary, 'output');
    fs.mkdirSync(photos);
    fs.mkdirSync(output);
    const originals = [];
    for (const [index, background] of ['#db4330', '#d34532', '#356baa'].entries()) {
      const file = path.join(photos, `synthetic-${index + 1}.jpg`);
      await sharp({ create: { width: 640, height: 400, channels: 3, background } }).jpeg({ quality: 90 }).toFile(file);
      originals.push({ file, sha256: digest(file) });
    }
    launch(binary, ['--demo', '--smoke', '--qa-script', path.join(__dirname, 'ui-cap-smoke.js')]);
    launch(binary, ['--demo', '--smoke', '--qa-script', path.join(__dirname, 'sync-ui-smoke.js')]);
    launch(binary, ['--smoke', '--verify-root', photos, '--qa-output', output, '--qa-script', path.join(__dirname, 'native-smoke.js')]);
    const exported = path.join(output, 'synthetic-native-export.jpg');
    const info = await sharp(exported).metadata();
    if (info.format !== 'jpeg' || info.width !== 100 || info.height !== 80) throw new Error('Production JPEG save returned the wrong output format or dimensions');
    for (const original of originals) if (digest(original.file) !== original.sha256) throw new Error('A synthetic original changed during packaged smoke');
    if (fs.readdirSync(photos).length !== originals.length) throw new Error('Packaged smoke unexpectedly added or removed source photos');
    launch(binary, ['--smoke', '--verify-root', photos, '--qa-output', output, '--qa-script', path.join(__dirname, 'sync-smoke.js')]);
    const retained = fs.readdirSync(photos).filter(name => /\.jpe?g$/i.test(name));
    const pending = path.join(photos, '待删');
    const batches = fs.readdirSync(pending);
    if (retained.length !== 1 || batches.length !== 1) throw new Error('SD synchronization must retain one fixture and create one recoverable batch');
    const journal = JSON.parse(fs.readFileSync(path.join(pending, batches[0], '同步记录.json'), 'utf8'));
    if (journal.kept.length !== 1 || journal.moved.length !== 2 || journal.errors?.length || journal.cancelled) throw new Error('SD synchronization journal does not report one kept and two moved fixtures');
    for (const original of originals) {
      const move = journal.moved.find(item => path.resolve(photos, item.from) === original.file);
      const file = move ? path.resolve(photos, move.to) : original.file;
      const relative = path.relative(temporary, file);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('SD smoke journal points outside its synthetic fixture');
      if (digest(file) !== original.sha256) throw new Error('SD synchronization changed a synthetic photo');
    }
    console.log('Packaged native smoke passed: capped collage, production IPC, JPEG disk export 100 × 80, unchanged original hashes, and recoverable SD sync keeping one and moving two.');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
