import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const BUILD = new URL('.', import.meta.url).pathname;
const SVG = readFileSync(join(BUILD, 'icon.svg'));

// --- 1. 主 PNG（1024 高清，给 Mac 自动转 .icns 用）---
await sharp(SVG).resize(1024, 1024).png().toFile(join(BUILD, 'icon.png'));
console.log('✓ icon.png (1024x1024)');

// --- 2. Windows .ico（多尺寸合成）---
const sizes = [16, 24, 32, 48, 64, 128, 256];
const buffers = await Promise.all(
  sizes.map((s) => sharp(SVG).resize(s, s).png().toBuffer()),
);
const ico = await pngToIco(buffers);
writeFileSync(join(BUILD, 'icon.ico'), ico);
console.log('✓ icon.ico (multi-size)');

// --- 3. Mac .icns（通过 iconutil 生成高质量版，供 electron-builder 可选）---
const ICONSET = join(BUILD, 'icon.iconset');
if (existsSync(ICONSET)) rmSync(ICONSET, { recursive: true, force: true });
mkdirSync(ICONSET);

const macSizes = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 },
];

for (const { name, size } of macSizes) {
  await sharp(SVG).resize(size, size).png().toFile(join(ICONSET, name));
}

try {
  execSync(`iconutil -c icns "${ICONSET}" -o "${join(BUILD, 'icon.icns')}"`, {
    stdio: 'inherit',
  });
  console.log('✓ icon.icns (via iconutil)');
} catch (e) {
  console.warn('iconutil 不可用（非 macOS 或未装），保留 PNG 让 electron-builder 自己转');
}

rmSync(ICONSET, { recursive: true, force: true });
console.log('done.');
