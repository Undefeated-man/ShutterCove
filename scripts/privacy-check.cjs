'use strict';

// Scan publishable source, including not-yet-staged files. Never read ignored
// runtime libraries, photo collections, build output, or credentials.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const skip = new Set(['.git', 'node_modules', 'dist', 'coverage', 'test-output', 'local-data']);

function walk(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (skip.has(entry.name) || entry.name === '.DS_Store') return [];
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) return [relative];
    return entry.isDirectory() ? walk(path.join(dir, entry.name), relative) : [relative];
  });
}

let files;
try {
  files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root, stdio: ['ignore', 'pipe', 'ignore']
  }).toString().split('\0').filter(Boolean);
  // Runtime images must never be explicitly tracked even if gitignore permits
  // local, ignored JPEG fixtures in tests.
} catch {
  files = walk(root);
}

const allowedBinary = /^(?:assets\/icon(?:\.png|\.icns)|docs\/screenshots\/[a-z0-9-]+\.png)$/;
const textExtension = /\.(?:[cm]?js|mjs|json|md|txt|ya?ml|html|css|svg|sh|xml|plist)$/i;
const forbiddenMedia = /\.(?:cr[23]|nef|arw|dng|raf|orf|rw2|jpe?g|heic|tiff?|mp[34]|mov)$/i;
const privateFile = /(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|credentials(?:\.json)?|library\.json|catalog\.json|photo-manifest[^/]*|organize-manifest[^/]*)$/i;
const patterns = [
  ['personal absolute path', /\/(?:Users|home|Volumes)\/[A-Za-z0-9\u3400-\u9fff][^\s"'`<>]*/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['provider API key', /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}/],
  ['AWS access key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
// Optional local terms can be supplied without embedding someone's identity
// or photo-folder names into the public scanner itself.
const privateTerms = process.env.PRIVACY_FORBIDDEN_TERMS ? JSON.parse(process.env.PRIVACY_FORBIDDEN_TERMS) : [];
if (!Array.isArray(privateTerms) || privateTerms.some(term => typeof term !== 'string' || !term)) {
  throw new Error('PRIVACY_FORBIDDEN_TERMS must be a JSON array of nonempty strings');
}
const problems = [];

function hasPNGMetadata(buffer) {
  let at = 8;
  while (at + 12 <= buffer.length) {
    const size = buffer.readUInt32BE(at);
    const type = buffer.toString('ascii', at + 4, at + 8);
    if (['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(type)) return true;
    if (size > buffer.length - at - 12) break;
    at += size + 12;
  }
  return false;
}

for (const relative of [...new Set(files)].sort()) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) continue;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) { problems.push([relative, 'symlink may expose external files']); continue; }
  if (!stat.isFile()) continue;
  if (forbiddenMedia.test(relative) || privateFile.test(relative)) {
    problems.push([relative, 'private media or runtime data must not be published']);
    continue;
  }
  const buffer = fs.readFileSync(target);
  if (allowedBinary.test(relative)) {
    if (relative.endsWith('.png')) {
      if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) problems.push([relative, 'invalid PNG file']);
      else if (hasPNGMetadata(buffer)) problems.push([relative, 'PNG contains metadata; strip it before publishing']);
    } else if (buffer.toString('ascii', 0, 4) !== 'icns') problems.push([relative, 'invalid icon file']);
    continue;
  }
  if (relative.startsWith('.') || ['LICENSE', 'NOTICE'].includes(relative) || textExtension.test(relative)) {
    if (buffer.includes(0)) { problems.push([relative, 'unexpected binary data']); continue; }
    const content = buffer.toString('utf8');
    // The scanner contains examples as regexes, not actual credentials. This
    // same scan still applies to itself and to dependency lockfiles.
    for (const [label, pattern] of patterns) {
      if (pattern.test(content)) problems.push([relative, label]);
    }
    if (privateTerms.some(term => content.toLocaleLowerCase().includes(term.toLocaleLowerCase()))) problems.push([relative, 'private local term']);
  } else {
    problems.push([relative, 'unapproved binary or file type']);
  }
}

if (problems.length) {
  for (const [relative, reason] of problems) console.error(`${relative}: ${reason}`);
  console.error(`Privacy check failed: ${problems.length} issue(s). No sensitive content was printed.`);
  process.exitCode = 1;
} else {
  console.log(`Privacy check passed: ${files.length} publishable files checked. Screenshot pixels require manual review.`);
}
