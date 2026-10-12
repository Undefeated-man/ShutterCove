'use strict';
const sharp = require('sharp');
async function prepareImageOutput(dataUrl, { preserveEncoding = false, png = false } = {}) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 400_000_000 || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) throw new Error('无效的图像数据');
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const meta = await sharp(bytes, { limitInputPixels: 400_000_000 }).metadata();
  if (preserveEncoding) {
    if (png || !dataUrl.startsWith('data:image/jpeg;') || meta.format !== 'jpeg') throw new Error('分享成品请保存为 JPEG');
    await sharp(bytes, { limitInputPixels: 48_000_000 }).stats();
    return bytes;
  }
  return png ? sharp(bytes).png().toBuffer() : sharp(bytes).jpeg({ quality: 95, mozjpeg: true }).toBuffer();
}
module.exports = { prepareImageOutput };
