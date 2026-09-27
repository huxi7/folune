/**
 * [INPUT]: 依赖紧边界品牌图 folune-tight.png、sharp 与 png-to-ico
 * [OUTPUT]: 生成 PNG/ICNS/ICO 图标；纸面按高度铺到画布 ~96%、水平居中贴在透明方画布上
 * [POS]: 跨平台构建资产入口，用无透明外边的紧边界图铺满图标，不用带大片留白的母图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
// ---- 用紧边界图(无透明外边)而非带大片留白的母图; fileURLToPath 保证 Windows 路径可用 ----
const input = fileURLToPath(new URL('../../app/public/brand/folune-tight.png', import.meta.url));
const assets = new URL('../assets/', import.meta.url);
await mkdir(assets, { recursive: true });
// ---- 先合成 1024 主图:纸面按高度铺到画布 96%、水平居中,其余尺寸都从主图缩放 ----
const CANVAS = 1024, MARK_HEIGHT = 984;
const mark = await sharp(input).resize({ height: MARK_HEIGHT }).png().toBuffer();
const master = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: mark, gravity: 'center' }]).png().toBuffer();
await writeFile(new URL('icon.png', assets), master);
const chunks = [];
for (const [type, size] of [['icp4',16], ['icp5',32], ['icp6',64], ['ic07',128], ['ic08',256], ['ic09',512], ['ic10',1024]]) {
  const data = await sharp(master).resize(size, size).png().toBuffer();
  const header = Buffer.alloc(8); header.write(type); header.writeUInt32BE(data.length + 8, 4);
  chunks.push(header, data);
}
const header = Buffer.alloc(8); header.write('icns'); header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
await writeFile(new URL('icon.icns', assets), Buffer.concat([header, ...chunks]));
const windows = await Promise.all([16,32,48,64,128,256].map(size => sharp(master).resize(size,size).png().toBuffer()));
await writeFile(new URL('icon.ico', assets), await pngToIco(windows));
