#!/usr/bin/env bun
/**
 * Build Phaser multi-atlas JSON for single-frame original art.
 *
 * Each PNG under public/source-art/frames/<atlas>/ becomes one texture page
 * so runtime keeps atlas keys (e.g. 'ui') + frame names (e.g. 'btn_back.png')
 * without packed atlas sheets.
 *
 * Usage: bun tools/gen_frame_multiatlas.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';

const root = join(import.meta.dir, '..');
const framesRoot = join(root, 'public', 'source-art', 'frames');
const outDir = join(root, 'public', 'source-art', 'multiatlas');

/** Atlases currently loaded by Preloader. Expand when more scenes need art. */
const ATLASES = [
    'menu',
    'ui',
    'icon',
    'medal',
    'npc',
    'home',
    'dig_build',
    'build',
    'gate',
    'map',
    'site',
    'dig_monster',
    'dig_item',
    'dig_work',
    'weather',
];

function pngSize (path)
{
    const buf = readFileSync(path);
    if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG')
    {
        throw new Error(`not a PNG: ${path}`);
    }
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function listPngs (dir)
{
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((n) => n.endsWith('.png') && statSync(join(dir, n)).isFile())
        .sort();
}

if (!existsSync(framesRoot))
{
    console.error(`missing ${relative(root, framesRoot)} — copy Buried-Town frames first`);
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

let totalFrames = 0;
const summary = [];

for (const atlas of ATLASES)
{
    const atlasDir = join(framesRoot, atlas);
    const files = listPngs(atlasDir);
    if (files.length === 0)
    {
        console.warn(`skip empty/missing atlas: ${atlas}`);
        continue;
    }

    const textures = files.map((file) =>
    {
        const abs = join(atlasDir, file);
        const { w, h } = pngSize(abs);
        // basename only — Preloader sets path to source-art/frames/<atlas>/
        const image = file;
        return {
            image,
            format: 'RGBA8888',
            size: { w, h },
            scale: 1,
            frames: [
                {
                    filename: file,
                    rotated: false,
                    trimmed: false,
                    sourceSize: { w, h },
                    spriteSourceSize: { x: 0, y: 0, w, h },
                    frame: { x: 0, y: 0, w, h },
                    pivot: { x: 0.5, y: 0.5 },
                },
            ],
        };
    });

    const doc = {
        textures,
        meta: {
            app: 'buried-city-phaser/tools/gen_frame_multiatlas.mjs',
            version: '1.0',
            format: 'Phaser3 Multi Atlas (one PNG per frame)',
            atlas,
            frameCount: textures.length,
            source: 'public/source-art/frames',
        },
    };

    const outPath = join(outDir, `${atlas}.json`);
    writeFileSync(outPath, JSON.stringify(doc));
    totalFrames += textures.length;
    summary.push({ atlas, frames: textures.length, out: relative(root, outPath) });
    console.log(`wrote ${relative(root, outPath)} (${textures.length} frames)`);
}

// Full tree index for tooling / future full-load
const allIndex = {};
for (const atlas of readdirSync(framesRoot).sort())
{
    const d = join(framesRoot, atlas);
    if (!statSync(d).isDirectory()) continue;
    for (const file of listPngs(d))
    {
        allIndex[file] = `source-art/frames/${atlas}/${file}`;
    }
}
const indexPath = join(root, 'public', 'source-art', 'frame-index.json');
writeFileSync(indexPath, JSON.stringify(allIndex, null, 2) + '\n');
console.log(`wrote ${relative(root, indexPath)} (${Object.keys(allIndex).length} frames total on disk)`);
console.log(`preloader atlases: ${summary.length}, frames: ${totalFrames}`);
