'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');

async function main() {
  const out = path.resolve(__dirname, '../assets');
  await fs.mkdir(out, { recursive: true });
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#173F45"/><stop offset="1" stop-color="#668C83"/></linearGradient>
      <linearGradient id="light" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#F6EED8"/><stop offset="1" stop-color="#C7DAD0"/></linearGradient>
    </defs>
    <rect x="54" y="54" width="916" height="916" rx="220" fill="url(#sea)"/>
    <rect x="77" y="77" width="870" height="870" rx="201" fill="none" stroke="#FFFFFF" stroke-opacity=".18" stroke-width="3"/>
    <circle cx="512" cy="466" r="267" fill="none" stroke="#EEECDD" stroke-width="17" opacity=".75"/>
    <g fill="url(#light)" opacity=".94">
      <path d="M511 219L646 260L535 434L395 434Z"/>
      <path d="M716 322L748 460L543 451L473 330Z"/>
      <path d="M747 559L644 659L549 480L619 359Z"/>
      <path d="M512 713L376 672L487 498L627 498Z"/>
      <path d="M307 610L275 472L480 481L550 602Z"/>
      <path d="M276 373L379 273L474 452L404 573Z"/>
    </g>
    <circle cx="512" cy="466" r="53" fill="#244C50"/>
    <path d="M213 779C339 729 450 836 560 795C672 753 735 778 812 757" fill="none" stroke="#C2D8CF" stroke-width="12" stroke-linecap="round" opacity=".85"/>
    <circle cx="745" cy="215" r="14" fill="#F1D9A6"/>
  </svg>`);
  await sharp(svg).png().toFile(path.join(out, 'icon.png'));
  if (process.platform === 'darwin') {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'shiguang-icon-'));
    try {
      const iconset = path.join(temporary, 'AppIcon.iconset');
      await fs.mkdir(iconset);
      for (const size of [16, 32, 128, 256, 512]) {
        await sharp(svg).resize(size, size).png().toFile(path.join(iconset, `icon_${size}x${size}.png`));
        await sharp(svg).resize(size * 2, size * 2).png().toFile(path.join(iconset, `icon_${size}x${size}@2x.png`));
      }
      execFileSync('/usr/bin/iconutil', ['--convert', 'icns', '--output', path.join(out, 'icon.icns'), iconset]);
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
  }
  console.log('Generated application icon.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
