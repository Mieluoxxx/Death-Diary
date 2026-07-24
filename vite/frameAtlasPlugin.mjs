import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const genScript = join(root, 'tools', 'gen_frame_multiatlas.mjs');

function runGen (reason)
{
    const result = spawnSync('bun', [genScript], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.stdout?.trim())
    {
        process.stdout.write(`[frame-atlas] ${reason}\n${result.stdout}`);
    }
    if (result.status !== 0)
    {
        const err = result.stderr?.trim() || result.stdout?.trim() || 'gen_frame_multiatlas failed';
        throw new Error(`[frame-atlas] ${err}`);
    }
}

/**
 * Ensures multiatlas JSON + frames.gen.ts exist before dev/build,
 * and regenerates when PNGs or the manifest change in dev.
 */
export function frameAtlasPlugin ()
{
    let watching = false;

    return {
        name: 'frame-atlas-gen',
        buildStart ()
        {
            runGen('buildStart');
        },
        configureServer (server)
        {
            if (watching) return;
            watching = true;

            const watchRoots = [
                join(root, 'public', 'source-art', 'frames'),
                join(root, 'src', 'game', 'assets', 'atlasManifest.ts'),
            ];
            server.watcher.add(watchRoots);

            const regen = (path) =>
            {
                const norm = path.replace(/\\/g, '/');
                if (
                    norm.includes('/source-art/frames/')
                    || norm.endsWith('/atlasManifest.ts')
                )
                {
                    try
                    {
                        runGen(`watch ${norm}`);
                        server.ws.send({ type: 'full-reload', path: '*' });
                    }
                    catch (e)
                    {
                        server.config.logger.error(String(e?.message ?? e));
                    }
                }
            };

            server.watcher.on('add', regen);
            server.watcher.on('change', regen);
            server.watcher.on('unlink', regen);
        },
    };
}
