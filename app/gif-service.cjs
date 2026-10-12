'use strict';
const { Worker } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { request, limits } = require('../renderer/motion-model.js');

class GifService {
  constructor({ library, emit = () => {}, allowDemo = false, timeoutMs = 120000, workerFactory = (file, options) => new Worker(file, options) }) {
    this.library = library; this.emit = emit; this.allowDemo = allowDemo; this.timeoutMs = timeoutMs; this.workerFactory = workerFactory; this.job = null; this.ready = null; this.preparing = false; this.revision = 0;
  }
  async preview(value) {
    if (value?.demoSources !== undefined) throw new Error('真实相册只能使用已索引的 JPEG');
    return this._preview(value, async frame => {
      const authorized = await this.library.authorizePaths([frame.id], 'jpeg');
      if (authorized.length !== 1 || !/\.jpe?g$/i.test(authorized[0])) throw new Error('GIF 每帧需要一张可读取的 JPEG 照片');
      return authorized[0];
    });
  }
  async previewDemo(value, demoSources) {
    if (!this.allowDemo) throw new Error('演示 GIF 仅在演示模式可用');
    const options = request(value);
    if (!Array.isArray(demoSources) || demoSources.length !== options.frames.length || demoSources.some(source => typeof source !== 'string') || demoSources.reduce((total, source) => total + source.length, 0) > 22000000) throw new Error('无效的演示照片数据');
    let index = 0;
    return this._preview(value, async frame => {
      const source = demoSources[index++];
      if (!/^demo-(?:[0-9]|1[0-5])$/.test(frame.id) || source.length > 2800000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(source)) throw new Error('演示照片只能是有界的合成 PNG 或 JPEG');
      const bytes = Buffer.from(source.slice(source.indexOf(',') + 1), 'base64');
      if (bytes.length > 2000000) throw new Error('演示照片过大');
      const metadata = await require('sharp')(bytes, { limitInputPixels: 2000000 }).metadata();
      if (!['png', 'jpeg'].includes(metadata.format) || metadata.pages > 1 || metadata.width > 1200 || metadata.height > 1200) throw new Error('演示照片尺寸或格式无效');
      return bytes;
    });
  }
  async _preview(value, source) {
    if (this.job || this.preparing) throw new Error('正在生成 GIF，请完成或取消当前任务');
    const options = request(value), revision = ++this.revision; this.preparing = true; this.ready = null;
    const files = [];
    try {
      for (const frame of options.frames) {
        if (revision !== this.revision) return { canceled: true };
        files.push(await source(frame));
      }
      if (revision !== this.revision) return { canceled: true };
      const started = Date.now(); this.emit({ kind: 'gif', done: 0, total: files.length + 1, etaSeconds: Math.ceil(files.length * .4), stage: 'frames' });
      return await new Promise((resolve, reject) => {
        const worker = this.workerFactory(path.join(__dirname, 'gif-worker.cjs'), { workerData: { options, files }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
        const job = { worker, resolve, reject, settled: false }; this.job = job;
        const finish = (error, result) => {
          if (job.settled) return; job.settled = true;
          clearTimeout(job.timer);
          if (this.job === job) this.job = null;
          worker.removeAllListeners(); void worker.terminate().catch(() => {});
          if (error) reject(error); else resolve(result);
        };
        job.timer = setTimeout(() => finish(new Error('GIF 合成超过 2 分钟，请减少帧数或降低尺寸后重试')), this.timeoutMs);
        job.timer.unref?.();
        worker.on('message', message => {
          if (message.error) return finish(new Error(message.error));
          if (message.progress) { const done = message.progress, total = message.total; this.emit({ kind: 'gif', done, total, stage: message.stage, etaSeconds: Math.ceil((Date.now() - started) / 1000 / done * (total - done)) }); return; }
          if (message.result) {
            const bytes = Buffer.from(message.result);
            if (bytes.length > limits.encodedBytes || !/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) return finish(new Error('GIF 编码结果无效'));
            const token = crypto.randomBytes(24).toString('hex'); this.ready = { token, bytes, created: Date.now() };
            this.emit({ kind: 'gif', done: files.length + 1, total: files.length + 1, etaSeconds: 0, stage: 'ready' });
            finish(null, { token, dataUrl: 'data:image/gif;base64,' + bytes.toString('base64'), width: message.width, height: message.height, frames: message.frames, size: bytes.length, durationMs: message.delay.reduce((a, b) => a + b, 0), loop: message.loop });
          }
        });
        worker.once('error', error => finish(error)); worker.once('exit', code => { if (!job.settled) finish(new Error('GIF 生成进程提前退出（' + code + '）')); });
      });
    } finally { this.preparing = false; }
  }
  async cancel() {
    this.revision++; this.ready = null;
    const job = this.job;
    if (job && !job.settled) {
      job.settled = true; clearTimeout(job.timer); this.job = null; job.worker.removeAllListeners(); await job.worker.terminate().catch(() => {}); job.resolve({ canceled: true });
    }
    return { canceled: true };
  }
  release(token) { if (this.ready?.token === token) this.ready = null; return { released: true }; }
  async save(token, target) {
    const ready = this.ready;
    if (typeof token !== 'string' || !ready || ready.token !== token || Date.now() - ready.created > 60 * 60 * 1000) throw new Error('预览已失效，请重新生成 GIF');
    if (typeof target !== 'string' || path.extname(target).toLowerCase() !== '.gif') throw new Error('请选择 .gif 文件保存动图');
    const temp = path.join(path.dirname(target), '.' + path.basename(target) + '.' + crypto.randomBytes(6).toString('hex') + '.tmp');
    try { await fs.writeFile(temp, ready.bytes, { flag: 'wx' }); await fs.rename(temp, target); }
    finally { await fs.unlink(temp).catch(() => {}); }
    return { canceled: false, path: target, size: ready.bytes.length };
  }
  async close() { await this.cancel(); }
}
module.exports = { GifService };
