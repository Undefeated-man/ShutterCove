'use strict';
/* Shared, dependency-free geometry keeps the editor and native GIF compositor aligned. */
(function (scope) {
  const limits = Object.freeze({ frames: 80, side: 1600, pixels: 24000000, overlays: 8, text: 120, encodedBytes: 24000000 });
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const number = (value, min, max, label) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('无效的' + label); return value; };
  function overlays(values = []) {
    if (!Array.isArray(values) || values.length > limits.overlays) throw new Error('每张照片最多添加 8 段文字或气泡');
    return values.map(value => {
      if (!value || !['speech', 'thought', 'text'].includes(value.type) || typeof value.text !== 'string' || value.text.length > limits.text) throw new Error('无效的文字气泡');
      if (![value.color || '#253c35', value.fill || '#fffaf0'].every(color => /^#[a-f0-9]{6}$/i.test(color))) throw new Error('无效的文字颜色');
      return { type: value.type, text: value.text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''), x: number(value.x, 0, 1, '文字横坐标'), y: number(value.y, 0, 1, '文字纵坐标'), width: number(value.width, .12, .9, '文字宽度'), font: number(value.font, .015, .12, '文字字号'), color: value.color || '#253c35', fill: value.fill || '#fffaf0' };
    });
  }
  function request(value) {
    if (!value || !Array.isArray(value.frames) || value.frames.length < 2 || value.frames.length > limits.frames) throw new Error('请选择 2 至 80 张带 JPEG 的照片制作 GIF');
    const width = number(value.width, 96, limits.side, 'GIF 宽度'), height = number(value.height, 96, limits.side, 'GIF 高度');
    if (!Number.isInteger(width) || !Number.isInteger(height) || width * height * value.frames.length > limits.pixels) throw new Error('动图超过 2,400 万总像素，请缩小尺寸或减少帧数');
    const delay = number(value.delay, 50, 5000, '每帧时长');
    if (!Number.isInteger(delay) || typeof value.loop !== 'boolean' || ![64, 128, 256].includes(value.colors)) throw new Error('无效的 GIF 播放或色彩设置');
    if (value.background !== undefined && !/^#[a-f0-9]{6}$/i.test(value.background)) throw new Error('无效的 GIF 背景颜色');
    return { width, height, delay: Math.round(delay / 10) * 10, loop: value.loop, colors: value.colors, background: value.background || '#faf7ee', frames: value.frames.map(frame => {
      if (!frame || typeof frame.id !== 'string' || !frame.id || frame.id.length > 128 || Object.keys(frame).some(key => !['id', 'overlays'].includes(key))) throw new Error('只能使用相册中已索引的照片');
      return { id: frame.id, overlays: overlays(frame.overlays) };
    }) };
  }
  function lines(text, available, font) {
    const result = []; let line = '', used = 0;
    for (const char of text) { const weight = char.charCodeAt(0) > 255 ? font : font * .6; if (char === '\n' || used + weight > available && line) { result.push(line); line = ''; used = 0; if (char === '\n') continue; } line += char; used += weight; }
    result.push(line); return result;
  }
  function geometry(overlay, width, height) {
    const w = Math.min(width, Math.max(32, width * overlay.width));
    const font = Math.max(8, Math.min(width * overlay.font, height * .18, w * .2)), padding = overlay.type === 'text' ? font * .25 : font * .75;
    const wrapped = lines(overlay.text, w - padding * 2, font), tail = overlay.type === 'text' ? 0 : font * .65;
    const h = Math.min(height - tail, wrapped.length * font * 1.35 + padding * 2);
    const x = Math.min(width - w, overlay.x * width), y = Math.min(height - h - tail, overlay.y * height);
    return { x: Math.max(0, x), y: Math.max(0, y), w, h, font, padding, tail, lines: wrapped.slice(0, Math.max(1, Math.floor((h - padding * 2) / (font * 1.35) + 1e-6))) };
  }
  function svg(values, width, height) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' + values.map(o => {
      const g = geometry(o, width, height), radius = o.type === 'thought' ? g.h / 2 : g.font * .8;
      const shape = o.type === 'text' ? '' : '<rect x="' + g.x + '" y="' + g.y + '" width="' + g.w + '" height="' + g.h + '" rx="' + radius + '" fill="' + o.fill + '" stroke="' + o.color + '" stroke-width="' + Math.max(1, width * .0016) + '"/>';
      const tail = o.type === 'speech' ? '<path d="M' + (g.x + g.w * .23) + ' ' + (g.y + g.h - 1) + 'l-' + g.font * .42 + ' ' + g.tail + ' ' + g.font * 1.3 + ' -' + g.tail + '" fill="' + o.fill + '" stroke="' + o.color + '" stroke-width="' + Math.max(1, width * .0016) + '"/>' : o.type === 'thought' ? '<circle cx="' + (g.x + g.w * .22) + '" cy="' + (g.y + g.h + g.font * .2) + '" r="' + g.font * .15 + '" fill="' + o.fill + '"/><circle cx="' + (g.x + g.w * .18) + '" cy="' + (g.y + g.h + g.font * .55) + '" r="' + g.font * .09 + '" fill="' + o.fill + '"/>' : '';
      const text = g.lines.map((line, i) => '<text x="' + (g.x + g.padding) + '" y="' + (g.y + g.padding + g.font + i * g.font * 1.35) + '" font-family="PingFang SC,Noto Sans CJK SC,Arial,sans-serif" font-size="' + g.font + '" font-weight="600" fill="' + o.color + '"' + (o.type === 'text' ? ' stroke="' + o.fill + '" stroke-width="' + g.font * .12 + '" paint-order="stroke" stroke-linejoin="round"' : '') + '>' + esc(line) + '</text>').join('');
      return shape + tail + text;
    }).join('') + '</svg>';
  }
  const exported = Object.freeze({ limits, request, overlays, geometry, svg });
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else scope.MotionModel = exported;
})(typeof window === 'object' ? window : globalThis);
