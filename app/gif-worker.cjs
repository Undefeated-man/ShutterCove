'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const sharp = require('sharp');
const { svg, limits } = require('../renderer/motion-model.js');

(async () => {
  sharp.cache(false); sharp.concurrency(1);
  const { files, options } = workerData, { width, height, frames, background, colors, delay, loop } = options;
  // One bounded RGB strip; no original photo or intermediate image is copied to disk.
  const strip = Buffer.alloc(width * height * 3 * frames.length);
  for (let index = 0; index < frames.length; index++) {
    const source = typeof files[index] === 'string' ? files[index] : Buffer.from(files[index]);
    let pipeline = sharp(source, { limitInputPixels: 100000000, failOn: 'error' }).rotate().resize(width, height, { fit: 'contain', background }).flatten({ background }).toColourspace('srgb');
    if (frames[index].overlays.length) pipeline = pipeline.composite([{ input: Buffer.from(svg(frames[index].overlays, width, height)) }]);
    const frame = await pipeline.removeAlpha().raw().toBuffer();
    if (frame.length !== width * height * 3) throw new Error('照片帧尺寸不一致');
    frame.copy(strip, index * frame.length);
    parentPort.postMessage({ progress: index + 1, total: frames.length + 1, stage: 'frames' });
  }
  const bytes = await sharp(strip, { raw: { width, height: height * frames.length, channels: 3, pageHeight: height }, limitInputPixels: limits.pixels }).gif({ colors, effort: 3, dither: .75, delay: frames.map(() => delay), loop: loop ? 0 : 1, keepDuplicateFrames: true, interFrameMaxError: 0 }).toBuffer();
  if (bytes.length > limits.encodedBytes) throw new Error('GIF 超过 24 MB，请降低尺寸或色彩数量');
  const metadata = await sharp(bytes, { animated: true, limitInputPixels: limits.pixels }).metadata();
  if (metadata.format !== 'gif' || metadata.pages !== frames.length || metadata.width !== width || metadata.pageHeight !== height) throw new Error('GIF 编码结果无效');
  const data = Uint8Array.from(bytes);
  parentPort.postMessage({ result: data, width, height, frames: frames.length, delay: metadata.delay, loop: metadata.loop }, [data.buffer]);
})().catch(error => parentPort.postMessage({ error: error.message || 'GIF 合成失败' }));
