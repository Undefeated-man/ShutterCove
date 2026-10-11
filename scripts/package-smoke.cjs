'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function photoFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '待删') return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? photoFiles(file) : entry.isFile() && /\.(?:jpe?g|cr3)$/i.test(entry.name) ? [file] : [];
  });
}

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
  // xvfb-run has a separate process ID. The shell prints its own PID and then
  // execs Electron, preserving that PID; filenames remain separate arguments.
  const parameters = linux ? ['-a', '/bin/sh', '-c', 'printf "SHIGUANG_SMOKE_PID=%s\\n" "$$"; exec "$@"', 'shiguang-smoke', binary, '--no-sandbox', ...args] : args;
  const result = spawnSync(command, parameters, { cwd: root, stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 180_000 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Packaged smoke failed: exit ${result.status}, signal ${result.signal || 'none'}`);
  const pid = linux ? Number(result.stdout.match(/^SHIGUANG_SMOKE_PID=(\d+)$/m)?.[1]) : result.pid;
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Cannot identify the packaged smoke application process');
  return pid;
}

async function main() {
  const binary = executable();
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shiguang-package-smoke-')));
  let nativeUserData;
  try {
    const photos = path.join(temporary, 'photos');
    const output = path.join(temporary, 'output');
    fs.mkdirSync(photos);
    fs.mkdirSync(output);
    const originals = [];
    for (const [index, background] of ['#db4330', '#d34532', '#356baa'].entries()) {
      const directory = path.join(photos, `synthetic-album-${index + 1}`);
      fs.mkdirSync(directory);
      const file = path.join(directory, `synthetic-${index + 1}.jpg`);
      await sharp({ create: { width: 640, height: 400, channels: 3, background } }).jpeg({ quality: 90 }).toFile(file);
      originals.push({ file, format: 'jpeg', sha256: digest(file) });
      if (index === 0) {
        const raw = path.join(directory, `synthetic-${index + 1}.CR3`);
        fs.writeFileSync(raw, Buffer.from('Synthetic CR3 byte fixture for copy testing; not a camera image.\n'));
        originals.push({ file: raw, format: 'raw', sha256: digest(raw) });
      }
    }
    launch(binary, ['--demo', '--smoke', '--qa-script', path.join(__dirname, 'ui-cap-smoke.js')]);
    launch(binary, ['--demo', '--smoke', '--qa-script', path.join(__dirname, 'sync-ui-smoke.js')]);
    const fontSmoke = path.join(__dirname, 'font-ui-smoke.js');
    if (!fs.existsSync(fontSmoke)) throw new Error('Required font-size UI smoke script is missing');
    launch(binary, ['--demo', '--smoke', '--compact', '--qa-script', fontSmoke]);
    for (const script of ['date-ui-smoke.js', 'timeline-ui-smoke.js', 'dropdown-ui-smoke.js', 'copy-ui-smoke.js', 'scan-ui-smoke.js', 'sticky-ui-smoke.js']) {
      const smoke = path.join(__dirname, script);
      if (!fs.existsSync(smoke)) throw new Error(`Required UI smoke script is missing: ${script}`);
      launch(binary, ['--demo', '--smoke', '--compact', '--qa-script', smoke]);
    }
    const nativePID = launch(binary, ['--smoke', '--verify-root', photos, '--qa-output', output, '--qa-script', path.join(__dirname, 'native-smoke.js')]);
    nativeUserData = path.join(os.tmpdir(), `shiguang-smoke-${nativePID}`);
    const settings = JSON.parse(fs.readFileSync(path.join(nativeUserData, 'settings.json'), 'utf8'));
    if (settings.fontScale !== 1.4) throw new Error('Font-size setting was not persisted to the application settings file');
    const exported = path.join(output, 'synthetic-native-export.jpg');
    const info = await sharp(exported).metadata();
    if (info.format !== 'jpeg' || info.width !== 100 || info.height !== 80) throw new Error('Production JPEG save returned the wrong output format or dimensions');
    for (const original of originals) if (digest(original.file) !== original.sha256) throw new Error('A synthetic original changed during packaged smoke');
    if (photoFiles(photos).length !== originals.length) throw new Error('Packaged smoke unexpectedly added or removed source photos');
    const copied = photoFiles(output).filter(file => file !== exported);
    const expectedCopies = originals.reduce((count, original) => count + (original.format === 'jpeg' ? 3 : 1), 0);
    if (copied.length !== expectedCopies || fs.readdirSync(output, { withFileTypes: true }).some(entry => entry.isDirectory())) throw new Error('Production copy must create flat JPEG batches and one optional synthetic CR3 pair');
    const copyHashes = copied.map(digest);
    for (const original of originals) if (copyHashes.filter(hash => hash === original.sha256).length !== (original.format === 'jpeg' ? 3 : 1)) throw new Error('Production copies do not preserve the synthetic JPEG and CR3 bytes');
    launch(binary, ['--smoke', '--verify-root', photos, '--qa-output', output, '--qa-script', path.join(__dirname, 'sync-smoke.js')]);
    const retained = photoFiles(photos);
    const pending = path.join(photos, '待删');
    const batches = fs.readdirSync(pending);
    if (!retained.length || batches.length !== 1) throw new Error('SD synchronization must retain the selected fixture group and create one recoverable batch');
    const journal = JSON.parse(fs.readFileSync(path.join(pending, batches[0], '同步记录.json'), 'utf8'));
    if (journal.kept.length !== retained.length || journal.kept.length + journal.moved.length !== originals.length || journal.errors?.length || journal.cancelled) throw new Error('SD synchronization journal does not account for all synthetic JPEG and CR3 files');
    for (const original of originals) {
      const move = journal.moved.find(item => path.resolve(photos, item.from) === original.file);
      const file = move ? path.resolve(photos, move.to) : original.file;
      const relative = path.relative(temporary, file);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('SD smoke journal points outside its synthetic fixture');
      if (digest(file) !== original.sha256) throw new Error('SD synchronization changed a synthetic photo');
    }
    console.log('Packaged native smoke passed: capped collage, font-size UI and persisted settings, calendar input, date timeline, filter dropdowns, copy UI, complete scan results, sticky gallery toolbar, production IPC, JPEG disk export 100 × 80, flat collision-safe JPEG and optional CR3 copies with matching hashes and unchanged originals, and recoverable SD sync retaining the selected group.');
  } finally {
    if (nativeUserData) fs.rmSync(nativeUserData, { recursive: true, force: true });
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
