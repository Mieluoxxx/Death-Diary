/**
 * HomeNode under Navigation — home map is drawn by HomeScene.
 * This mount only signals home mode (no extra chrome content).
 */

import type { NodeMountContext, NodeMountResult } from '../navigation';

export function mountHomeNode(_ctx: NodeMountContext): NodeMountResult {
    // HomeScene owns the map sprites; nav host hides its frame when on Home.
    return {};
}
