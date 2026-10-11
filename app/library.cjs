'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const exifr = require('exifr');
const { ExifTool } = require('exiftool-vendored');

const CACHE_LIMIT = 512 * 1024 * 1024;
const EXIF_HEADER_LIMIT = 1024 * 1024;
const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.cr3']);
const DATE_FOLDER = /^(?:\d{4}[-_.]?\d{2}[-_.]?\d{2}|\d{1,2}[.\-_]\d{1,2})$/;
const SPECIAL_FOLDER = /^(精品|favorites?|精选)$/i;
const AUXILIARY_FOLDER = /^(照片|photos?|jpegs?|raws?|cr3|精品|favorites?|精选)$/i;
const IGNORE_FOLDERS = new Set(['.git', 'node_modules', '.shiguang-cache', '$RECYCLE.BIN', '.Trashes', '.Spotlight-V100', '待删']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function dateString(value, fallback) {
  let date = value;
  if (value && typeof value.toDate === 'function') date = value.toDate();
  if (!(date instanceof Date)) {
    if (typeof date === 'string') date = new Date(date.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
    else date = new Date(fallback);
  }
  if (!date || !Number.isFinite(date.getTime())) date = new Date(fallback);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function folderDateString(value, root) {
  const full = value.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})$/);
  if (full) return `${full[1]}-${full[2]}-${full[3]}`;
  const short = value.match(/^(\d{1,2})[.\-_](\d{1,2})$/);
  const year = root.match(/(?:^|[^\d])(20\d{2})(?:[^\d]|$)/)?.[1] || String(new Date().getFullYear());
  return short ? `${year}-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}` : undefined;
}

function rgbFamily(rgb) {
  const [r, g, b] = rgb.map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const lightness = (max + min) / 2;
  if (max < .15) return 'black';
  if (min > .86) return 'white';
  if (delta < .09 || (delta / Math.max(.001, max)) < .16) return 'gray';
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = ((hue * 60) + 360) % 360;
  if (hue >= 15 && hue < 55 && lightness < .42) return 'brown';
  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 70) return 'yellow';
  if (hue < 165) return 'green';
  if (hue < 195) return 'cyan';
  if (hue < 255) return 'blue';
  if (hue < 295) return 'purple';
  return 'pink';
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) throw new Error('图像特征尺寸不一致');
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return !na && !nb ? 1 : 0;
  return Math.max(-1, Math.min(1, dot / Math.sqrt(na * nb)));
}

async function parallel(items, concurrency, fn) {
  const result = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) { const index = next++; if (index >= items.length) return; result[index] = await fn(items[index], index); }
  }));
  return result;
}

async function readExifHeader(file, size) {
  const handle = await fs.open(file, 'r');
  try {
    const header = Buffer.alloc(Math.min(size, EXIF_HEADER_LIMIT));
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return header.subarray(0, bytesRead);
  } finally { await handle.close(); }
}

class PhotoLibrary {
  constructor({ userData, emit = () => {}, cacheLimit = CACHE_LIMIT } = {}) {
    if (!userData) throw new Error('需要指定应用数据目录');
    this.userData = path.resolve(userData);
    this.cacheDir = path.join(this.userData, 'previews');
    this.metadataFile = path.join(this.userData, 'library.json');
    this.cacheLimit = cacheLimit;
    this.emit = emit;
    this.photos = new Map();
    this.roots = new Set();
    this.state = { version: 1, metadata: {}, aliases: {}, files: {} };
    this.inflight = new Map();
    this.thumbnailQueue = [];
    this.thumbnailRunning = 0;
    this.jobs = new Map();
    this.syncPlans = new Map();
    this.saveChain = Promise.resolve();
    this.cacheChain = Promise.resolve();
    this.exifTool = null;
  }

  async init() {
    await fs.mkdir(this.cacheDir, { recursive: true });
    try {
      const saved = JSON.parse(await fs.readFile(this.metadataFile, 'utf8'));
      if (saved && saved.version === 1 && typeof saved.metadata === 'object') {
        this.state = { version: 1, metadata: saved.metadata || {}, aliases: saved.aliases || {}, files: saved.files || {} };
      }
    } catch (error) {
      if (error.code !== 'ENOENT') this.emit({ kind: 'warning', message: '相册标签记录无法读取；原照片不受影响。' });
    }
    await this._evictCache();
    return this;
  }

  _tool() {
    if (!this.exifTool) this.exifTool = new ExifTool({ maxProcs: 2, taskTimeoutMillis: 30000 });
    return this.exifTool;
  }

  async close() {
    await this.saveChain;
    if (this.exifTool) await this.exifTool.end();
  }

  _save() {
    this.saveChain = this.saveChain.catch(() => {}).then(async () => {
      const temporary = `${this.metadataFile}.${process.pid}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(this.state), { mode: 0o600 });
      await fs.rename(temporary, this.metadataFile);
    });
    return this.saveChain;
  }

  async _root(root) {
    const absolute = path.resolve(root);
    const stat = await fs.lstat(absolute);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('请选择真实文件夹，不能选择符号链接');
    const real = await fs.realpath(absolute);
    this.roots.add(real);
    return real;
  }

  async _authorized(file) {
    const absolute = path.resolve(file);
    const stat = await fs.lstat(absolute);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('文件不存在或是符号链接');
    const real = await fs.realpath(absolute);
    if (![...this.roots].some(root => inside(root, real))) throw new Error('照片不在已选择的目录中');
    return real;
  }

  async _walk(root) {
    const files = [];
    const walk = async directory => {
      let entries;
      try { entries = await fs.readdir(directory, { withFileTypes: true }); }
      catch (error) { this.emit({ kind: 'warning', message: `无法读取文件夹：${path.basename(directory)}` }); return; }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const absolute = path.join(directory, entry.name);
        if (inside(this.userData, absolute)) continue;
        if (entry.isDirectory()) {
          if (!IGNORE_FOLDERS.has(entry.name) && !entry.name.startsWith('.')) await walk(absolute);
        } else if (entry.isFile() && PHOTO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
      }
    };
    await walk(root);
    return files;
  }

  _themeContext(root, file) {
    const folders = path.relative(root, path.dirname(file)).split(path.sep).filter(Boolean);
    const themeIndex = folders.findIndex(folder => !DATE_FOLDER.test(folder) && !AUXILIARY_FOLDER.test(folder));
    const themeFolder = themeIndex >= 0 ? folders[themeIndex] : null;
    return {
      theme: themeFolder || path.basename(root),
      anchor: themeFolder ? path.join(root, ...folders.slice(0, themeIndex + 1)) : root,
      favorite: folders.some(folder => SPECIAL_FOLDER.test(folder)),
      folderDate: folderDateString(folders.find(folder => DATE_FOLDER.test(folder)) || '', root),
    };
  }

  async _describe(file, root, { readRaw = false } = {}) {
    const stat = await fs.stat(file);
    const context = this._themeContext(root, file);
    const ext = path.extname(file).toLowerCase();
    const cached = this.state.files[file];
    if (cached && cached.size === stat.size && cached.mtime === stat.mtimeMs && (!readRaw || cached.rawMetadataRead)) {
      return { file, ext, stem: path.basename(file, path.extname(file)), ...cached,
        date: cached.exifDate || context.folderDate || dateString(stat.mtime, stat.mtimeMs), ...context };
    }
    let exif = {}, image = {};
    if (ext === '.cr3' && readRaw) {
      exif = await this._tool().read(file).catch(() => {
        this.emit({ kind: 'warning', message: `无法读取 RAW 拍摄信息：${path.basename(file)}；使用日期文件夹或文件修改日期。` });
        return {};
      });
    } else if (ext !== '.cr3') {
      [exif, image] = await Promise.all([
        readExifHeader(file, stat.size).then(header => exifr.parse(header, { gps: false, pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'Make', 'Model', 'LensModel', 'Lens', 'ExifImageWidth', 'ExifImageHeight'] })).catch(() => ({})),
        sharp(file, { failOn: 'none' }).metadata().catch(() => ({})),
      ]);
    }
    exif = exif || {};
    let originalDate = exif.DateTimeOriginal || exif.CreateDate;
    if (originalDate && typeof originalDate.toDate === 'function') originalDate = originalDate.toDate();
    const descriptor = {
      size: stat.size, mtime: stat.mtimeMs, exifDate: originalDate ? dateString(originalDate, stat.mtimeMs) : null,
      captureTime: originalDate instanceof Date ? originalDate.getTime() : stat.mtimeMs,
      dateFromExif: Boolean(originalDate), width: image.width || exif.ExifImageWidth || exif.ImageWidth || 0,
      height: image.height || exif.ExifImageHeight || exif.ImageHeight || 0, rawMetadataRead: ext !== '.cr3' || readRaw,
      camera: exif.Model && exif.Make && String(exif.Model).startsWith(String(exif.Make)) ? String(exif.Model) : [exif.Make, exif.Model].filter(Boolean).join(' '),
      lens: exif.LensModel || exif.Lens || '',
    };
    this.state.files[file] = descriptor;
    return { file, ext, stem: path.basename(file, path.extname(file)), ...descriptor,
      date: descriptor.exifDate || context.folderDate || dateString(stat.mtime, stat.mtimeMs), ...context };
  }

  _group(entries) {
    const buckets = new Map();
    for (const entry of entries) {
      const key = `${entry.anchor}\0${entry.stem.toLocaleLowerCase()}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry);
    }
    const result = [];
    for (const entries of buckets.values()) {
      const jpegEntries = entries.filter(entry => entry.ext !== '.cr3');
      const rawEntries = entries.filter(entry => entry.ext === '.cr3');
      const partitions = new Map();
      const add = (key, entry) => {
        if (!partitions.has(key)) partitions.set(key, []);
        partitions.get(key).push(entry);
      };
      for (const entry of jpegEntries) add(entry.date, entry);
      for (const entry of rawEntries) {
        let matchingDate = entry.date;
        if (!partitions.has(matchingDate) && partitions.size === 1) matchingDate = [...partitions.keys()][0];
        add(matchingDate, entry);
      }
      for (const [partitionDate, partition] of partitions) {
        const jpgs = partition.filter(entry => entry.ext !== '.cr3').sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.file.localeCompare(b.file));
        const raws = partition.filter(entry => entry.ext === '.cr3').sort((a, b) => a.file.localeCompare(b.file));
        const primary = jpgs[0] || raws[0];
        const date = partition.find(entry => entry.dateFromExif)?.date || partition.find(entry => entry.folderDate)?.date || partitionDate;
        const id = hash(`${primary.anchor}\0${primary.stem.toLocaleLowerCase()}\0${date}`).slice(0, 24);
        const allPaths = partition.map(entry => entry.file);
        const priorId = allPaths.map(file => this.state.aliases[file]).find(Boolean);
        const stored = this.state.metadata[id] || this.state.metadata[priorId] || {};
        result.push({
          id, name: primary.stem, stem: primary.stem,
          jpegPath: jpgs[0]?.file || null, rawPath: raws[0]?.file || null, path: primary.file,
          allPaths, date, theme: stored.theme ?? primary.theme, tags: stored.tags || [],
          favorite: stored.favorite ?? partition.some(entry => entry.favorite),
          color: stored.color || null, colorFamily: stored.colorFamily || 'unknown',
          width: primary.width, height: primary.height, camera: primary.camera, lens: primary.lens,
          size: partition.reduce((sum, entry) => sum + entry.size, 0),
        });
        if (priorId && priorId !== id && !this.state.metadata[id]) this.state.metadata[id] = { ...stored };
        for (const file of allPaths) this.state.aliases[file] = id;
      }
    }
    return result.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  }

  async scan(root, { stream = true } = {}) {
    root = await this._root(root);
    const files = await this._walk(root);
    const priority = file => path.extname(file).toLowerCase() === '.cr3' ? 2 : path.dirname(file).split(path.sep).some(folder => SPECIAL_FOLDER.test(folder)) ? 0 : 1;
    files.sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
    const jpegKeys = new Set(files.filter(file => path.extname(file).toLowerCase() !== '.cr3').map(file => {
      return `${this._themeContext(root, file).anchor}\0${path.basename(file, path.extname(file)).toLocaleLowerCase()}`;
    }));
    let done = 0;
    const accumulated = [];
    this.emit({ kind: 'scan', done, total: files.length, stream });
    const descriptions = await parallel(files, 4, async file => {
      try {
        const key = `${this._themeContext(root, file).anchor}\0${path.basename(file, path.extname(file)).toLocaleLowerCase()}`;
        const description = await this._describe(file, root, { readRaw: path.extname(file).toLowerCase() === '.cr3' && !jpegKeys.has(key) });
        accumulated.push(description);
        return description;
      }
      catch (error) {
        this.emit({ kind: 'warning', message: `无法读取照片：${path.basename(file)}（${error.message}）` });
        return null;
      }
      finally {
        done++;
        if (done === 12 || done % 40 === 0 || done === files.length) {
          const progress = { kind: 'scan', done, total: files.length, stream };
          if (stream) {
            const earlyPhotos = this._group(accumulated);
            for (const photo of earlyPhotos) this.photos.set(photo.id, photo);
            progress.photos = earlyPhotos.slice(0, 120);
          }
          this.emit(progress);
        }
      }
    });
    const photos = this._group(descriptions.filter(Boolean));
    const foundIds = new Set(photos.map(photo => photo.id));
    for (const [id, photo] of this.photos) if (!foundIds.has(id) && photo.allPaths.every(file => inside(root, file))) this.photos.delete(id);
    for (const photo of photos) this.photos.set(photo.id, photo);
    await this._save();
    return { root, photos };
  }

  _photo(id) {
    const photo = this.photos.get(id);
    if (!photo) throw new Error('找不到这张照片，请刷新文件夹');
    return photo;
  }

  get(id) { return this._photo(id); }

  async update(ids, patch) {
    if (!Array.isArray(ids)) ids = [ids];
    const result = [];
    for (const id of ids) {
      const photo = this._photo(id);
      const stored = { ...this.state.metadata[id] };
      for (const key of ['theme', 'favorite', 'color', 'colorFamily']) {
        if (Object.hasOwn(patch, key)) {
          if (key === 'favorite') stored[key] = Boolean(patch[key]);
          else if (typeof patch[key] === 'string' || patch[key] === null) stored[key] = patch[key];
        }
      }
      let tags = Array.isArray(patch.tags) ? patch.tags : photo.tags;
      if (Array.isArray(patch.addTags)) tags = [...tags, ...patch.addTags];
      if (Array.isArray(patch.removeTags)) tags = tags.filter(tag => !patch.removeTags.includes(tag));
      stored.tags = [...new Set(tags.filter(tag => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean))];
      this.state.metadata[id] = stored;
      Object.assign(photo, stored);
      result.push({ ...photo });
    }
    await this._save();
    return result;
  }

  _queuedThumbnail(fn) {
    return new Promise((resolve, reject) => {
      this.thumbnailQueue.push({ fn, resolve, reject });
      this._drainThumbnails();
    });
  }

  _drainThumbnails() {
    while (this.thumbnailRunning < 4 && this.thumbnailQueue.length) {
      const job = this.thumbnailQueue.shift();
      this.thumbnailRunning++;
      Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(() => { this.thumbnailRunning--; this._drainThumbnails(); });
    }
  }

  async _touch(file) {
    const now = new Date();
    await fs.utimes(file, now, now).catch(() => {});
    return file;
  }

  async _cached(file) {
    try { const stat = await fs.stat(file); if (stat.size) return this._touch(file); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return null;
  }

  async _rawPreview(raw) {
    raw = await this._authorized(raw);
    const stat = await fs.stat(raw);
    const key = hash(`raw:${raw}:${stat.size}:${stat.mtimeMs}`);
    const destination = path.join(this.cacheDir, `raw-${key}.jpg`);
    if (await this._cached(destination)) return destination;
    if (this.inflight.has(key)) return this.inflight.get(key);
    const work = (async () => {
      const temporary = `${destination}.${process.pid}.tmp.jpg`;
      try {
        try { await this._tool().extractJpgFromRaw(raw, temporary); await sharp(temporary, { failOn: 'none' }).metadata(); }
        catch (error) {
          await fs.rm(temporary, { force: true });
          await this._tool().extractPreview(raw, temporary);
        }
        await sharp(temporary, { failOn: 'none' }).metadata();
        await fs.rename(temporary, destination);
        await this._evictCache(destination);
        return destination;
      } catch (error) {
        throw new Error(`无法读取 RAW 内嵌预览：${path.basename(raw)}（可直接用修图软件打开 RAW）`, { cause: error });
      } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
    })();
    this.inflight.set(key, work);
    try { return await work; } finally { this.inflight.delete(key); }
  }

  async source(id, format = 'jpeg') {
    const photo = this._photo(id);
    if (format === 'raw') {
      if (!photo.rawPath) throw new Error('这张照片没有对应的 CR3');
      return this._rawPreview(photo.rawPath);
    }
    if (photo.jpegPath) return this._authorized(photo.jpegPath);
    if (photo.rawPath) return this._rawPreview(photo.rawPath);
    throw new Error('原照片已不存在');
  }

  async thumbnail(id, size = 600) {
    size = Math.max(64, Math.min(1600, Number(size) || 600));
    const photo = this._photo(id);
    const original = await this._authorized(photo.jpegPath || photo.rawPath);
    const stat = await fs.stat(original);
    const key = hash(`${original}:${stat.size}:${stat.mtimeMs}:${size}`);
    const destination = path.join(this.cacheDir, `thumb-${key}.jpg`);
    if (await this._cached(destination)) return destination;
    if (this.inflight.has(key)) return this.inflight.get(key);
    const work = this._queuedThumbnail(async () => {
      if (await this._cached(destination)) return destination;
      const source = await this.source(id);
      const temporary = `${destination}.${process.pid}.tmp`;
      try {
        await sharp(source, { failOn: 'none' }).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: false }).toFile(temporary);
        await fs.rename(temporary, destination);
        await this._evictCache(destination);
        return destination;
      } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
    });
    this.inflight.set(key, work);
    try { return await work; } finally { this.inflight.delete(key); }
  }

  _evictCache(protectedPath) {
    this.cacheChain = this.cacheChain.catch(() => {}).then(async () => {
      const entries = await fs.readdir(this.cacheDir);
      const files = (await Promise.all(entries.filter(name => !name.includes('.tmp')).map(async name => {
        const file = path.join(this.cacheDir, name);
        const stat = await fs.stat(file).catch(() => null);
        return stat?.isFile() ? { file, size: stat.size, mtime: stat.mtimeMs } : null;
      }))).filter(Boolean);
      let total = files.reduce((sum, file) => sum + file.size, 0);
      for (const file of files.sort((a, b) => a.mtime - b.mtime)) {
        if (total <= this.cacheLimit) break;
        if (file.file === protectedPath && file.size <= this.cacheLimit) continue;
        await fs.rm(file.file, { force: true });
        total -= file.size;
      }
    });
    return this.cacheChain;
  }

  async cacheInfo() {
    const entries = await fs.readdir(this.cacheDir);
    const stats = await Promise.all(entries.map(name => fs.stat(path.join(this.cacheDir, name)).catch(() => null)));
    return { bytes: stats.reduce((sum, stat) => sum + (stat?.isFile() ? stat.size : 0), 0), limit: this.cacheLimit, files: stats.filter(stat => stat?.isFile()).length };
  }

  async clearCache() {
    await Promise.allSettled([...this.inflight.values()]);
    await this.cacheChain;
    const entries = await fs.readdir(this.cacheDir);
    await Promise.all(entries.map(name => fs.rm(path.join(this.cacheDir, name), { force: true })));
    return this.cacheInfo();
  }

  cancel(kind) {
    const job = this.jobs.get(kind);
    if (job) job.cancelled = true;
    return Boolean(job);
  }

  _start(kind, total) {
    this.cancel(kind);
    const job = { cancelled: false, started: Date.now(), done: 0, total };
    this.jobs.set(kind, job);
    this.emit({ kind, done: 0, total, etaSeconds: Math.ceil(total * (kind === 'similarity' ? .18 : .09)) });
    return job;
  }

  _progress(kind, job) {
    const remaining = job.total - job.done;
    const average = job.done >= 4 ? (Date.now() - job.started) / 1000 / job.done : kind === 'similarity' ? .18 : .09;
    this.emit({ kind, done: job.done, total: job.total, etaSeconds: Math.ceil(remaining * average), cancelled: job.cancelled });
  }

  async analyzeColors(ids) {
    if (!ids) ids = [...this.photos.keys()];
    const job = this._start('colors', ids.length);
    const updated = [];
    await parallel(ids, 4, async id => {
      if (job.cancelled) return;
      try {
        const thumbnail = await this.thumbnail(id, 128);
        const { data, info } = await sharp(thumbnail).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const sum = [0, 0, 0];
        for (let i = 0; i < data.length; i += info.channels) { sum[0] += data[i]; sum[1] += data[i + 1]; sum[2] += data[i + 2]; }
        const rgb = sum.map(value => Math.round(value / (info.width * info.height)));
        const color = `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('')}`;
        const photo = this._photo(id);
        const patch = { color, colorFamily: rgbFamily(rgb) };
        Object.assign(photo, patch);
        this.state.metadata[id] = { ...this.state.metadata[id], ...patch };
        updated.push({ ...photo });
      } catch (error) { this.emit({ kind: 'warning', message: `色系分析跳过 ${this.photos.get(id)?.name || id}：预览无法读取` }); }
      finally { job.done++; this._progress('colors', job); }
    });
    await this._save();
    if (this.jobs.get('colors') === job) this.jobs.delete('colors');
    return { photos: updated, cancelled: job.cancelled };
  }

  async _pixels(photo, grid) {
    const block = 4, side = grid * block;
    const preview = await this.thumbnail(photo.id, Math.max(128, side));
    const { data, info } = await sharp(preview).removeAlpha().toColourspace('srgb').resize(side, side, { fit: 'fill', kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
    const pooled = new Float32Array(grid * grid * 3);
    for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
      const target = (y * grid + x) * 3;
      for (let dy = 0; dy < block; dy++) for (let dx = 0; dx < block; dx++) {
        const offset = ((y * block + dy) * side + x * block + dx) * info.channels;
        pooled[target] += data[offset] / (block * block);
        pooled[target + 1] += data[offset + 1] / (block * block);
        pooled[target + 2] += data[offset + 2] / (block * block);
      }
    }
    return pooled;
  }

  async similar({ referenceId, directory, grid = 16, limit = 60 }) {
    const reference = this._photo(referenceId);
    grid = Math.round(Math.max(4, Math.min(128, Number(grid) || 16)));
    limit = Math.round(Math.max(1, Math.min(5000, Number(limit) || 60)));
    let candidates;
    if (directory) candidates = (await this.scan(directory, { stream: false })).photos;
    else candidates = [...this.photos.values()];
    const referencePaths = new Set(reference.allPaths || [reference.jpegPath, reference.rawPath].filter(Boolean));
    candidates = candidates.filter(photo => photo.id !== referenceId && !(photo.allPaths || []).some(file => referencePaths.has(file)));
    const job = this._start('similarity', candidates.length);
    const query = await this._pixels(reference, grid);
    const scored = [];
    await parallel(candidates, 4, async photo => {
      if (job.cancelled) return;
      try {
        const vector = await this._pixels(photo, grid);
        scored.push({ ...photo, similarity: cosine(query, vector) });
      } catch (error) { /* One unreadable image must not stop a directory search. */ }
      finally { job.done++; this._progress('similarity', job); }
    });
    if (this.jobs.get('similarity') === job) this.jobs.delete('similarity');
    return { photos: scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit), cancelled: job.cancelled, grid, total: candidates.length };
  }

  filePaths(ids, format = 'both') {
    if (!Array.isArray(ids)) ids = [ids];
    return [...new Set(ids.flatMap(id => {
      const photo = this._photo(id);
      if (format === 'raw') return photo.rawPath ? [photo.rawPath] : [];
      if (format === 'jpeg') return photo.jpegPath ? [photo.jpegPath] : [];
      return photo.allPaths || [photo.jpegPath, photo.rawPath].filter(Boolean);
    }))];
  }

  async authorizePaths(ids, format = 'both') {
    return Promise.all(this.filePaths(ids, format).map(file => this._authorized(file)));
  }

  async copySelected({ ids, directory, destination, includeRaw = false } = {}) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 50000 || ids.some(id => typeof id !== 'string' || id.length > 128)) throw new Error('请选择 1 至 50,000 组照片');
    if (typeof includeRaw !== 'boolean') throw new Error('请选择是否包含 CR3 原片');
    ids = [...new Set(ids)];
    const selected = ids.map(id => this._photo(id));
    const requested = directory || destination;
    if (typeof requested !== 'string' || !requested) throw new Error('请选择复制目标文件夹');
    const requestedPath = path.resolve(requested);
    const directoryStat = await fs.lstat(requestedPath);
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new Error('复制目标必须是真实文件夹，不能是符号链接');
    directory = await fs.realpath(requestedPath);
    if (inside(this.userData, directory)) throw new Error('不能复制到应用内部数据目录');
    for (const photo of selected) {
      for (const file of [photo.jpegPath, photo.rawPath].filter(Boolean)) {
        const parent = await fs.realpath(path.dirname(file)).catch(() => path.dirname(file));
        if (parent === directory) throw new Error('复制目标不能是所选原片所在文件夹，请选择其他文件夹');
      }
    }
    const verifyDirectory = async () => {
      const current = await fs.lstat(directory);
      if (current.isSymbolicLink() || !current.isDirectory() || current.dev !== directoryStat.dev || current.ino !== directoryStat.ino || await fs.realpath(directory) !== directory) throw new Error('复制目标文件夹已变化，请重新选择');
    };
    const stemKey = stem => stem.normalize('NFKC').toLocaleLowerCase();
    const occupied = new Set((await fs.readdir(directory)).filter(name => PHOTO_EXTENSIONS.has(path.extname(name).toLowerCase())).map(name => stemKey(path.basename(name, path.extname(name)))));
    const copied = [], skipped = [], errors = [];
    const job = this._start('copy', selected.length);
    try {
      for (const photo of selected) {
        if (job.cancelled) break;
        try {
          await verifyDirectory();
          const files = [photo.jpegPath && { source: photo.jpegPath, format: 'jpeg' }, includeRaw && photo.rawPath && { source: photo.rawPath, format: 'raw' }].filter(Boolean);
          if (!files.length) {
            skipped.push({ id: photo.id, name: photo.name, reason: photo.rawPath ? 'raw-only' : 'no-original', message: photo.rawPath ? '仅有 CR3；勾选“包含 CR3 原片”后可以复制。' : '这组照片没有可复制的原片。' });
            continue;
          }
          const available = [];
          for (const file of files) {
            try {
              const source = await this._authorized(file.source);
              available.push({ ...file, source, stat: await fs.stat(source) });
            } catch (error) { errors.push({ id: photo.id, name: photo.name, source: file.source, message: error.message }); }
          }
          if (!available.length) continue;
          const primary = photo.jpegPath || photo.rawPath;
          const stem = path.basename(primary, path.extname(primary));
          let completed = false;
          for (let suffix = 0; !completed; suffix++) {
            if (suffix > 100000) throw new Error('同名照片过多，请选择其他目标文件夹');
            const outputStem = `${stem}${suffix ? `-${suffix + 1}` : ''}`;
            if (occupied.has(stemKey(outputStem))) continue;
            occupied.add(stemKey(outputStem));
            const group = [];
            let collision = false;
            for (const file of available) {
              const target = path.join(directory, outputStem + path.extname(file.source));
              let created = false, targetStat;
              try {
                await verifyDirectory();
                await this._authorized(file.source);
                await fs.copyFile(file.source, target, require('node:fs').constants.COPYFILE_EXCL);
                created = true;
                targetStat = await fs.lstat(target);
                const currentSource = await fs.stat(file.source);
                if (!targetStat.isFile() || targetStat.isSymbolicLink() || currentSource.dev !== file.stat.dev || currentSource.ino !== file.stat.ino || currentSource.size !== file.stat.size || currentSource.mtimeMs !== file.stat.mtimeMs || targetStat.size !== file.stat.size || await this._digest(file.source) !== await this._digest(target)) throw new Error('复制校验失败；原片可能已变化');
                await verifyDirectory();
                await fs.utimes(target, file.stat.atime, file.stat.mtime);
                group.push({ id: photo.id, format: file.format, source: file.source, path: target, stat: targetStat });
              } catch (error) {
                if (created) {
                  const current = await fs.lstat(target).catch(() => null);
                  if (current && targetStat && current.dev === targetStat.dev && current.ino === targetStat.ino) await fs.unlink(target).catch(() => {});
                }
                if (error.code === 'EEXIST') { collision = true; break; }
                errors.push({ id: photo.id, name: photo.name, source: file.source, message: error.message });
              }
            }
            if (collision) {
              // Retry the whole pair with one suffix; never unlink the pre-existing collision.
              for (const file of group) {
                const current = await fs.lstat(file.path).catch(() => null);
                if (current && current.dev === file.stat.dev && current.ino === file.stat.ino) await fs.unlink(file.path);
                else throw new Error('复制结果已被修改，无法安全重试同名文件');
              }
            } else {
              copied.push(...group.map(({ stat, ...file }) => file));
              completed = true;
            }
          }
        } catch (error) { errors.push({ id: photo.id, name: photo.name, message: error.message }); }
        finally { job.done++; if (this.jobs.get('copy') === job) this._progress('copy', job); }
      }
    } finally {
      if (job.cancelled && this.jobs.get('copy') === job) this._progress('copy', job);
      if (this.jobs.get('copy') === job) this.jobs.delete('copy');
    }
    return { directory, destination: directory, copied, copiedCount: copied.length, skipped, skippedCount: skipped.length, errors, errorCount: errors.length, cancelled: job.cancelled };
  }

  async forget(ids) {
    for (const id of ids) {
      const photo = this.photos.get(id);
      if (photo) for (const file of photo.allPaths || []) delete this.state.aliases[file];
      if (photo) for (const file of photo.allPaths || []) delete this.state.files[file];
      this.photos.delete(id);
      delete this.state.metadata[id];
    }
    await this._save();
    return true;
  }

  async _digest(file) {
    const handle = await fs.open(file, 'r');
    try {
      const digest = crypto.createHash('sha256');
      for await (const chunk of handle.createReadStream({ autoClose: false })) digest.update(chunk);
      return digest.digest('hex');
    } finally { await handle.close(); }
  }

  _selectionFingerprint(ids) {
    return hash(JSON.stringify(ids.map(id => {
      const photo = this._photo(id);
      return { id, stem: photo.stem, date: photo.date, paths: photo.allPaths, theme: photo.theme, tags: photo.tags, favorite: photo.favorite };
    })));
  }

  async syncPreview({ directory, ids }) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('请先选择要保留的精品照片');
    ids = [...new Set(ids)];
    directory = await this._root(directory);
    if (directory.split(path.sep).includes('待删')) throw new Error('不能选择待删目录作为 SD 卡');
    const selected = ids.map(id => this._photo(id));
    const wanted = new Map();
    for (const photo of selected) {
      for (const stem of new Set([photo.stem, ...(photo.allPaths || []).map(file => path.basename(file, path.extname(file)))].map(stem => String(stem).normalize('NFKC').toLocaleLowerCase()))) {
        if (!wanted.has(stem)) wanted.set(stem, []);
        wanted.get(stem).push(photo);
      }
    }
    const files = await this._walk(directory);
    const jpegKeys = new Set(files.filter(file => path.extname(file).toLowerCase() !== '.cr3').map(file => `${path.dirname(file)}\0${path.basename(file, path.extname(file)).toLocaleLowerCase()}`));
    let done = 0;
    this.emit({ kind: 'sync-preview', done, total: files.length });
    const descriptions = await parallel(files, 4, async file => {
      const key = `${path.dirname(file)}\0${path.basename(file, path.extname(file)).toLocaleLowerCase()}`;
      const entry = await this._describe(file, directory, { readRaw: path.extname(file).toLowerCase() === '.cr3' && !jpegKeys.has(key) });
      done++;
      if (done % 20 === 0 || done === files.length) this.emit({ kind: 'sync-preview', done, total: files.length });
      return entry;
    });
    const jpegDates = new Map();
    for (const entry of descriptions.filter(entry => entry.ext !== '.cr3')) {
      const key = `${path.dirname(entry.file)}\0${entry.stem.toLocaleLowerCase()}`;
      if (!jpegDates.has(key)) jpegDates.set(key, new Set());
      jpegDates.get(key).add(entry.date);
    }
    for (const entry of descriptions.filter(entry => entry.ext === '.cr3')) {
      const dates = jpegDates.get(`${path.dirname(entry.file)}\0${entry.stem.toLocaleLowerCase()}`);
      if (dates?.size === 1) entry.date = [...dates][0];
    }
    const buckets = new Map();
    for (const entry of descriptions) {
      const stem = entry.stem.normalize('NFKC').toLocaleLowerCase();
      if (!buckets.has(stem)) buckets.set(stem, []);
      buckets.get(stem).push(entry);
    }
    const ambiguous = [];
    for (const [stem, entries] of buckets) if (wanted.has(stem) && new Set(entries.map(entry => entry.date)).size > 1) ambiguous.push(entries[0].stem);
    if (ambiguous.length) throw new Error(`存在同名但拍摄日期不同的照片，已停止同步：${ambiguous.slice(0, 5).join('、')}`);
    const matchedIds = new Set(), kept = [], protectedFiles = [], nonselected = [];
    for (const entry of descriptions) {
      const matches = wanted.get(entry.stem.normalize('NFKC').toLocaleLowerCase()) || [];
      const exact = matches.filter(photo => photo.date === entry.date);
      if (exact.length) { kept.push(entry.file); for (const photo of exact) matchedIds.add(photo.id); }
      else if (matches.length) protectedFiles.push(entry.file);
      else nonselected.push(entry.file);
    }
    if (!kept.length) throw new Error('SD 卡中没有找到名称及拍摄日期匹配的精品照片，已停止同步；没有移动任何文件');
    const batchName = `批次-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    const batchDirectory = path.join(directory, '待删', batchName);
    const moves = nonselected.map(file => ({ from: path.relative(directory, file), to: path.relative(directory, path.join(batchDirectory, path.relative(directory, file))) }));
    const snapshots = await Promise.all(files.map(async file => {
      const authorized = await this._authorized(file), stat = await fs.stat(authorized);
      const described = descriptions.find(entry => entry.file === file);
      if (stat.size !== described.size || stat.mtimeMs !== described.mtime) throw new Error('SD 卡文件在预览分析期间已变化，请重新预览');
      return { file: authorized, size: stat.size, mtime: stat.mtimeMs };
    }));
    const token = crypto.randomUUID();
    const plan = { token, directory, batchDirectory, keepCount: kept.length, moveCount: moves.length, kept: kept.map(file => path.relative(directory, file)), moves,
      unmatched: selected.filter(photo => !matchedIds.has(photo.id)).map(photo => photo.name), ambiguous,
      protected: protectedFiles.map(file => path.relative(directory, file)), protectedCount: protectedFiles.length };
    this.syncPlans.set(token, { plan, snapshots, ids, fingerprint: this._selectionFingerprint(ids), created: Date.now() });
    if (this.syncPlans.size > 10) this.syncPlans.delete(this.syncPlans.keys().next().value);
    return plan;
  }

  async syncFavorites({ token }) {
    const saved = this.syncPlans.get(token);
    if (!saved || Date.now() - saved.created > 30 * 60 * 1000) throw new Error('同步预览已过期，请重新预览');
    if (saved.fingerprint !== this._selectionFingerprint(saved.ids)) throw new Error('精品选择或照片信息已变化，请重新预览');
    for (const snapshot of saved.snapshots) {
      const file = await this._authorized(snapshot.file), stat = await fs.stat(file);
      if (file !== snapshot.file || stat.size !== snapshot.size || stat.mtimeMs !== snapshot.mtime) throw new Error('SD 卡文件已变化，请重新预览；没有移动任何文件');
    }
    const currentFiles = await this._walk(saved.plan.directory);
    if (currentFiles.length !== saved.snapshots.length || currentFiles.some(file => !saved.snapshots.some(snapshot => snapshot.file === file))) throw new Error('SD 卡照片列表已变化，请重新预览');
    this.syncPlans.delete(token);
    const { plan } = saved;
    const pendingRoot = path.join(plan.directory, '待删');
    await fs.mkdir(pendingRoot, { recursive: true });
    if ((await fs.lstat(pendingRoot)).isSymbolicLink()) throw new Error('待删目录不能是符号链接');
    await fs.mkdir(plan.batchDirectory);
    const journalPath = path.join(plan.batchDirectory, '同步记录.json');
    const journal = { version: 1, directory: plan.directory, batchDirectory: plan.batchDirectory, kept: plan.kept, moved: [], created: new Date().toISOString() };
    const saveJournal = async () => { const temporary = `${journalPath}.tmp`; await fs.writeFile(temporary, JSON.stringify(journal, null, 2)); await fs.rename(temporary, journalPath); };
    await saveJournal();
    const job = this._start('sync', plan.moves.length), errors = [];
    const snapshotByFile = new Map(saved.snapshots.map(snapshot => [snapshot.file, snapshot]));
    try {
      for (const move of plan.moves) {
        if (job.cancelled) break;
        const from = path.join(plan.directory, move.from), to = path.join(plan.directory, move.to);
        try {
          const authorized = await this._authorized(from), stat = await fs.stat(authorized), snapshot = snapshotByFile.get(authorized);
          if (!snapshot || stat.size !== snapshot.size || stat.mtimeMs !== snapshot.mtime) throw new Error('文件在同步期间已变化，已跳过');
          await fs.mkdir(path.dirname(to), { recursive: true });
          if (!inside(plan.batchDirectory, await fs.realpath(path.dirname(to)))) throw new Error('待删目标目录已变成符号链接');
          try { await fs.lstat(to); throw new Error('待删目标已存在，不能覆盖'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
          // Journal the intention before rename so an interrupted process remains recoverable.
          journal.moved.push(move);
          await saveJournal();
          await fs.rename(from, to);
        } catch (error) { errors.push({ from: move.from, message: error.message }); }
        finally { job.done++; this._progress('sync', job); }
      }
      journal.cancelled = job.cancelled;
      journal.errors = errors;
      await saveJournal();
      const moved = [];
      for (const move of journal.moved) if (await fs.stat(path.join(plan.directory, move.to)).then(() => true).catch(() => false)) moved.push(move);
      return { directory: plan.directory, batchDirectory: plan.batchDirectory, kept: plan.kept, moved, movedCount: moved.length, errors, cancelled: job.cancelled };
    } finally { if (this.jobs.get('sync') === job) this.jobs.delete('sync'); }
  }

  async restoreSync({ batchDirectory }) {
    batchDirectory = await this._root(batchDirectory);
    const journal = JSON.parse(await fs.readFile(path.join(batchDirectory, '同步记录.json'), 'utf8'));
    if (journal.version !== 1 || path.resolve(journal.batchDirectory) !== batchDirectory || path.dirname(path.dirname(batchDirectory)) !== path.resolve(journal.directory) || path.basename(path.dirname(batchDirectory)) !== '待删') throw new Error('这不是有效的同步待删批次');
    const directory = await this._root(journal.directory), restored = [], errors = [];
    for (const move of journal.moved) {
      const from = path.resolve(directory, move.to), to = path.resolve(directory, move.from);
      if (!inside(batchDirectory, from) || !inside(directory, to) || inside(path.join(directory, '待删'), to) || !PHOTO_EXTENSIONS.has(path.extname(to).toLowerCase())) throw new Error('同步记录包含不安全路径');
      try {
        await this._authorized(from);
        try { await fs.lstat(to); throw new Error('原位置已有同名文件，未覆盖'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        await fs.mkdir(path.dirname(to), { recursive: true });
        const realParent = await fs.realpath(path.dirname(to));
        if (!inside(directory, realParent)) throw new Error('原目录已变成符号链接');
        await fs.rename(from, to);
        restored.push(move.from);
      } catch (error) { errors.push({ name: move.from, message: error.message }); }
    }
    return { directory, batchDirectory, restored, restoredCount: restored.length, errors };
  }

  async importPhotos({ source, destination, theme }) {
    if (typeof theme !== 'string' || !theme.trim() || theme === '.' || theme === '..' || /[\\/\0]/.test(theme)) throw new Error('主题名称不能包含路径分隔符');
    source = await this._root(source);
    destination = path.resolve(destination);
    await fs.mkdir(destination, { recursive: true });
    destination = await this._root(destination);
    const themeRoot = path.join(destination, theme.trim());
    if (inside(source, themeRoot) || inside(themeRoot, source)) throw new Error('导入来源和目标不能相互包含');
    await fs.mkdir(themeRoot, { recursive: true });
    const themeStat = await fs.lstat(themeRoot);
    if (themeStat.isSymbolicLink()) throw new Error('目标主题文件夹不能是符号链接');
    const sourceFiles = await this._walk(source);
    const knownFiles = await this._walk(destination);
    const known = new Map();
    for (const file of knownFiles) {
      const stat = await fs.stat(file);
      const key = `${path.extname(file).toLocaleLowerCase()}\0${stat.size}`;
      if (!known.has(key)) known.set(key, []);
      known.get(key).push(file);
    }
    const jpegKeys = new Set(sourceFiles.filter(file => path.extname(file).toLowerCase() !== '.cr3').map(file => `${path.dirname(file)}\0${path.basename(file, path.extname(file)).toLocaleLowerCase()}`));
    const described = (await parallel(sourceFiles, 4, file => {
      const key = `${path.dirname(file)}\0${path.basename(file, path.extname(file)).toLocaleLowerCase()}`;
      return this._describe(file, source, { readRaw: path.extname(file).toLowerCase() === '.cr3' && !jpegKeys.has(key) }).catch(() => null);
    })).filter(Boolean);
    const grouped = new Map();
    for (const file of described) {
      const key = `${path.dirname(file.file)}\0${file.stem.toLocaleLowerCase()}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(file);
    }
    const digestCache = new Map();
    const digest = async file => {
      if (!digestCache.has(file)) digestCache.set(file, this._digest(file));
      return digestCache.get(file);
    };
    let done = 0, skipped = 0;
    const imported = [], errors = [];
    const job = this._start('import', sourceFiles.length);
    for (const group of grouped.values()) {
      if (job.cancelled) break;
      const date = group.find(file => file.ext !== '.cr3')?.date || group[0].date;
      const directory = path.join(themeRoot, date);
      await fs.mkdir(directory, { recursive: true });
      const directoryStat = await fs.lstat(directory);
      if (directoryStat.isSymbolicLink()) throw new Error('目标日期文件夹不能是符号链接');
      const toCopy = [];
      for (const file of group) {
        const sameNames = known.get(`${file.ext}\0${file.size}`) || [];
        const sourceDigest = sameNames.length ? await digest(file.file) : null;
        let duplicate = false;
        for (const previous of sameNames) if (await digest(previous) === sourceDigest) { duplicate = true; break; }
        if (duplicate) { skipped++; done++; job.done = done; this._progress('import', job); }
        else toCopy.push(file);
      }
      let suffix = '';
      for (let n = 0;; n++) {
        suffix = n ? `-${n + 1}` : '';
        const destinations = toCopy.map(file => path.join(directory, `${file.stem}${suffix}${path.extname(file.file)}`));
        const exists = await Promise.all(destinations.map(file => fs.lstat(file).then(() => true).catch(error => { if (error.code === 'ENOENT') return false; throw error; })));
        if (exists.every(value => !value)) break;
      }
      for (const file of toCopy) {
        const target = path.join(directory, `${file.stem}${suffix}${path.extname(file.file)}`);
        let created = false;
        try {
          await this._authorized(file.file);
          await fs.copyFile(file.file, target, require('node:fs').constants.COPYFILE_EXCL);
          created = true;
          const targetStat = await fs.stat(target);
          if (targetStat.size !== file.size || await digest(file.file) !== await this._digest(target)) throw new Error('复制校验失败');
          const originalStat = await fs.stat(file.file);
          await fs.utimes(target, originalStat.atime, originalStat.mtime);
          imported.push(target);
          const key = `${file.ext}\0${file.size}`;
          if (!known.has(key)) known.set(key, []);
          known.get(key).push(target);
        } catch (error) {
          if (created) await fs.rm(target, { force: true });
          errors.push({ name: path.basename(file.file), message: error.message });
        } finally { done++; job.done = done; this._progress('import', job); }
      }
    }
    if (this.jobs.get('import') === job) this.jobs.delete('import');
    return { imported, skipped, errors, cancelled: job.cancelled, destination: themeRoot };
  }
}

module.exports = { PhotoLibrary, rgbFamily, cosine, dateString, inside, CACHE_LIMIT };
