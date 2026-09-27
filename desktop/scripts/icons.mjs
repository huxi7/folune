/**
 * [INPUT]: 依赖现有 1254px 品牌母图、sharp 与 png-to-ico
 * [OUTPUT]: 生成 PNG/ICNS/ICO 图标；尺寸转换保留原图透明画布
 * [POS]: 跨平台构建资产入口，不使用 favicon 放大或重绘品牌
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { mkdir, writeFile } from 'node:fs/promises';
const input = new URL('../../app/public/brand/folune.png', import.meta.url);
const assets = new URL('../assets/', import.meta.url);
await mkdir(assets, { recursive: true });
const png = await sharp(input.pathname).resize(1024, 1024).png().toBuffer();
await writeFile(new URL('icon.png', assets), png);
const chunks = [];
for (const [type, size] of [['icp4',16], ['icp5',32], ['icp6',64], ['ic07',128], ['ic08',256], ['ic09',512], ['ic10',1024]]) {
  const data = await sharp(input.pathname).resize(size, size).png().toBuffer();
  const header = Buffer.alloc(8); header.write(type); header.writeUInt32BE(data.length + 8, 4);
  chunks.push(header, data);
}
const header = Buffer.alloc(8); header.write('icns'); header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
await writeFile(new URL('icon.icns', assets), Buffer.concat([header, ...chunks]));
const windows = await Promise.all([16,32,48,64,128,256].map(size => sharp(input.pathname).resize(size,size).png().toBuffer()));
await writeFile(new URL('icon.ico', assets), await pngToIco(windows));
