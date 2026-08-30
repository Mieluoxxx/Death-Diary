/**
 * Navigation stack host (BottomFrameNode chrome).
 * Ports Buried-City Navigation: forward/back/root/replace + re-instantiate pages.
 * Hosted inside HomeScene — TopFrame stays; bottom content swaps.
 */

import type { GameObjects, Scene } from 'phaser';
import { getSession, mutateSession, type NavEntry, setBuildLevel } from '../session/sessionStore';
import { applyNavMusic, playClick } from '../systems/audioManager';
import { gameBusEmit } from '../systems/gameBus';
import { playerGoHome } from '../systems/mapSystem';
import { advanceGuide, GuideStep, isGuideStep, onGuideChanged } from '../systems/userGuide';
import { mountAdSiteNode } from './nodes/adSiteNode';
import { mountBattleNode } from './nodes/battleNode';
import { mountGateNode } from './nodes/gateNode';
import { mountGateOutNode } from './nodes/gateOutNode';
import { mountHomeNode } from './nodes/homeNode';
import { mountMapNode } from './nodes/mapNode';
import { mountNpcNode } from './nodes/npcNode';
import { mountNpcStorageNode } from './nodes/npcStorageNode';
import { mountRadioNode } from './nodes/radioNode';
import { mountSiteNode } from './nodes/siteNode';
import { mountSiteStorageNode } from './nodes/siteStorageNode';
import { mountStorageNode } from './nodes/storageNode';
import { mountWorkLootNode } from './nodes/workLootNode';
import { uiTextStyle } from './uiFont';
import { addGuideWarn, type GuideWarnHandle } from './userGuideUi';
export const NavNode = {
    HOME: 'HomeNode',
    STORAGE: 'StorageNode',
    GATE: 'GateNode',
    GATE_OUT: 'GateOutNode',
    MAP: 'MapNode',
    SITE: 'SiteNode',
    AD_SITE: 'AdSiteNode',
    SITE_STORAGE: 'SiteStorageNode',
    BATTLE_AND_WORK: 'BattleAndWorkNode',
    WORK_ROOM_STORAGE: 'WorkRoomStorageNode',
    RADIO: 'RadioNode',
    NPC: 'NpcNode',
    NPC_STORAGE: 'NpcStorageNode',
} as const;

export type NavHostHandle = {
    root: GameObjects.Container;
    forward: (nodeName: string, userData?: unknown) => void;
    back: () => void;
    replace: (nodeName: string, userData?: unknown) => void;
    rootTo: (nodeName: string, userData?: unknown) => void;
    currentName: () => string;
    destroy: () => void;
    /** Call from scene update for battle ticks etc. */
    update: (deltaMs: number) => void;
};

export type NodeMountContext = {
    scene: Scene;
    host: GameObjects.Container;
    content: GameObjects.Container;
    width: number;
    height: number;
    bgWidth: number;
    bgHeight: number;
    bgBottomY: number;
    toScreenX: (localX: number) => number;
    toScreenY: (localY: number) => number;
    setTitle: (title: string, opts?: { align?: 'left' | 'center' }) => void;
    setRightEnabled: (enabled: boolean, label?: string) => void;
    setLeftEnabled: (enabled: boolean) => void;
    forward: (nodeName: string, userData?: unknown) => void;
    back: () => void;
    replace: (nodeName: string, userData?: unknown) => void;
    rootTo: (nodeName: string, userData?: unknown) => void;
    userData: unknown;
    showToast: (msg: string) => void;
};

export type NodeMountResult = {
    /** Optional per-frame update (battle). */
    update?: (deltaMs: number) => void;
    onRight?: () => void;
    onLeft?: () => void;
    destroy?: () => void;
};

type NodeMounter = (ctx: NodeMountContext) => NodeMountResult;

const BG_WIDTH = 596;
const BG_HEIGHT = 839;
const BG_BOTTOM_OFFSET = 18;
const ACTION_BAR_LOCAL_Y = 803;
const CONTENT_TOP_LOCAL_Y = 770;
const CONTENT_Y_NUDGE = 14;

const MOUNTERS: Record<string, NodeMounter> = {
    [NavNode.HOME]: mountHomeNode,
    [NavNode.STORAGE]: mountStorageNode,
    [NavNode.GATE]: mountGateNode,
    [NavNode.GATE_OUT]: mountGateOutNode,
    [NavNode.MAP]: mountMapNode,
    [NavNode.SITE]: mountSiteNode,
    [NavNode.AD_SITE]: mountAdSiteNode,
    [NavNode.SITE_STORAGE]: mountSiteStorageNode,
    [NavNode.BATTLE_AND_WORK]: mountBattleNode,
    [NavNode.WORK_ROOM_STORAGE]: mountWorkLootNode,
    [NavNode.RADIO]: mountRadioNode,
    [NavNode.NPC]: mountNpcNode,
    [NavNode.NPC_STORAGE]: mountNpcStorageNode,
};

export function createNavigationHost(
    scene: Scene,
    opts?: {
        onHomeVisible?: (visible: boolean) => void;
        onToast?: (msg: string) => void;
    },
): NavHostHandle {
    const { width, height } = scene.scale;
    const root = scene.add.container(0, 0);
    root.setDepth(140);
    root.setName('navHost');

    const bgBottomY = height - BG_BOTTOM_OFFSET;
    const bgLeft = width / 2 - BG_WIDTH / 2;
    const toScreenY = (localY: number) => bgBottomY - localY;
    const toScreenX = (localX: number) => bgLeft + localX;

    // Solid fill under chrome (frame has transparent center).
    const fill = scene.add
        .rectangle(width / 2, bgBottomY - BG_HEIGHT / 2, BG_WIDTH, BG_HEIGHT, 0x000000)
        .setOrigin(0.5, 0.5);
    root.add(fill);

    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_bg_bottom.png')) {
        root.add(
            scene.add.image(width / 2, bgBottomY, 'ui', 'frame_bg_bottom.png').setOrigin(0.5, 1),
        );
    }

    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_line.png')) {
        root.add(
            scene.add.image(width / 2, toScreenY(CONTENT_TOP_LOCAL_Y), 'ui', 'frame_line.png'),
        );
    }

    const titleY = toScreenY(ACTION_BAR_LOCAL_Y);
    const titleText = scene.add
        .text(width / 2, titleY, '', {
            ...uiTextStyle('COMMON_1'),
            color: '#ffffff',
        })
        .setOrigin(0.5);
    root.add(titleText);

    const content = scene.add.container(0, 0);
    root.add(content);

    let leftBtn: GameObjects.Image | GameObjects.Rectangle | null = null;
    let rightBtn: GameObjects.Image | GameObjects.Rectangle | null = null;
    let rightLabel: GameObjects.Text | null = null;
    let activeNode: NodeMountResult | null = null;
    let destroyed = false;
    let chromeGuideWarn: GuideWarnHandle | null = null;

    const showToast = (msg: string) => {
        opts?.onToast?.(msg);
    };

    const setTitle = (title: string, opts?: { align?: 'left' | 'center' }) => {
        titleText.setText(title);
        const align = opts?.align ?? 'center';
        if (align === 'left') {
            // Original Site/Battle: title left of bar, after back btn.
            // leftBtn x=60; btn ~82 wide → title at 60 + 41 + 10 ≈ 111, anchor top-left.
            titleText.setOrigin(0, 0.5);
            titleText.setPosition(toScreenX(111), titleY);
        } else {
            titleText.setOrigin(0.5, 0.5);
            titleText.setPosition(width / 2, titleY);
        }
    };

    const setLeftEnabled = (enabled: boolean) => {
        if (!leftBtn) {
            return;
        }
        leftBtn.setVisible(enabled);
        leftBtn.setAlpha(enabled ? 1 : 0.35);
        if (enabled) {
            leftBtn.setInteractive({ useHandCursor: true });
        } else if ('disableInteractive' in leftBtn) {
            leftBtn.disableInteractive();
        }
    };

    const setRightEnabled = (enabled: boolean, _label?: string) => {
        if (rightBtn) {
            // Original Map/Home use icon-only arrows; hide when not needed.
            rightBtn.setVisible(enabled);
            rightBtn.setAlpha(enabled ? 1 : 0.35);
            if (enabled) {
                rightBtn.setInteractive({ useHandCursor: true });
            } else if ('disableInteractive' in rightBtn) {
                rightBtn.disableInteractive();
            }
        }
        // Never show text under forward (original is icon-only).
        if (rightLabel) {
            rightLabel.setVisible(false);
            rightLabel.setText('');
        }
    };

    // Back button (must live on root so chrome depth/visibility covers it)
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_back.png')) {
        leftBtn = scene.add
            .image(toScreenX(60), titleY, 'ui', 'btn_back.png')
            .setInteractive({ useHandCursor: true });
    } else {
        leftBtn = scene.add
            .rectangle(toScreenX(60), titleY, 82, 39, 0x333333)
            .setInteractive({ useHandCursor: true });
    }
    root.add(leftBtn);
    leftBtn.on('pointerup', () => {
        const nodeName = getStack().slice(-1)[0]?.nodeName;
        if (nodeName === NavNode.SITE) {
            advanceGuide(GuideStep.BACK_SITE);
        } else if (nodeName === NavNode.STORAGE) {
            if (isGuideStep(GuideStep.STORAGE_BACK)) {
                setBuildLevel(1, 0);
            }
            advanceGuide(GuideStep.STORAGE_BACK);
        }
        playClick();
        if (activeNode?.onLeft) {
            activeNode.onLeft();
        } else {
            back();
        }
    });
    // Forward / action button (right)
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_forward.png')) {
        rightBtn = scene.add
            .image(toScreenX(BG_WIDTH - 60), titleY, 'ui', 'btn_forward.png')
            .setInteractive({ useHandCursor: true });
    } else {
        rightBtn = scene.add
            .rectangle(toScreenX(BG_WIDTH - 60), titleY, 82, 39, 0x444444)
            .setInteractive({ useHandCursor: true });
    }
    root.add(rightBtn);
    rightLabel = scene.add
        .text(toScreenX(BG_WIDTH - 60), titleY + 28, '', {
            ...uiTextStyle(14),
            color: '#dddddd',
        })
        .setOrigin(0.5, 0)
        .setVisible(false);
    root.add(rightLabel);
    rightBtn.on('pointerup', () => {
        if (getStack().slice(-1)[0]?.nodeName === NavNode.GATE) {
            advanceGuide(GuideStep.GATE_OUT);
        }
        playClick();
        activeNode?.onRight?.();
    });
    const refreshChromeGuide = () => {
        chromeGuideWarn?.destroy();
        chromeGuideWarn = null;
        const nodeName = getStack().slice(-1)[0]?.nodeName;
        if (rightBtn && nodeName === NavNode.GATE && isGuideStep(GuideStep.GATE_OUT)) {
            chromeGuideWarn = addGuideWarn(scene, rightBtn);
        } else if (
            leftBtn &&
            ((nodeName === NavNode.SITE && isGuideStep(GuideStep.BACK_SITE)) ||
                (nodeName === NavNode.STORAGE && isGuideStep(GuideStep.STORAGE_BACK)))
        ) {
            chromeGuideWarn = addGuideWarn(scene, leftBtn);
        }
    };

    const clearContent = () => {
        activeNode?.destroy?.();
        activeNode = null;
        content.removeAll(true);
    };

    const persistStack = (stack: NavEntry[]) => {
        mutateSession((live) => {
            live.navigation = stack;
        });
    };

    const getStack = (): NavEntry[] => {
        const session = getSession();
        return session?.navigation?.length ? [...session.navigation] : [{ nodeName: NavNode.HOME }];
    };

    const mountCurrent = () => {
        if (destroyed) {
            return;
        }
        clearContent();
        let stack = getStack();
        if (stack.length === 0) {
            stack = [{ nodeName: NavNode.HOME }];
            persistStack(stack);
        }
        const top = stack[stack.length - 1]!;
        const nodeName = top.nodeName;

        // Home map visibility: only when stack is exactly Home.
        const homeVisible = nodeName === NavNode.HOME && stack.length === 1;
        opts?.onHomeVisible?.(homeVisible);
        fill.setVisible(!homeVisible);
        // Hide chrome frame when on pure home map (home draws its own bottom).
        root.list.forEach((child) => {
            if (child === content) {
                return;
            }
            // Keep root chrome hidden only for pure home.
            if (homeVisible && child !== content) {
                (
                    child as GameObjects.GameObject & {
                        setVisible?: (v: boolean) => void;
                    }
                ).setVisible?.(false);
            } else {
                (
                    child as GameObjects.GameObject & {
                        setVisible?: (v: boolean) => void;
                    }
                ).setVisible?.(true);
            }
        });
        content.setVisible(true);

        if (nodeName === NavNode.HOME) {
            // Home is drawn by HomeScene; still call goHome if returning.
            playerGoHome();
            setTitle('');
            setRightEnabled(false);
            setLeftEnabled(false);
            const mounter = MOUNTERS[nodeName];
            if (mounter) {
                activeNode = mounter(makeCtx(top.userData));
            }
            applyNavMusic(nodeName);
            gameBusEmit('nav_changed', { nodeName });
            gameBusEmit('session_updated');
            refreshChromeGuide();
            return;
        }

        setLeftEnabled(true);
        setRightEnabled(false, '');
        const mounter = MOUNTERS[nodeName];
        if (!mounter) {
            setTitle(nodeName);
            content.add(
                scene.add
                    .text(width / 2, height / 2, `未实现: ${nodeName}`, {
                        ...uiTextStyle(20),
                        color: '#fff',
                    })
                    .setOrigin(0.5),
            );
            applyNavMusic(nodeName);
            gameBusEmit('nav_changed', { nodeName });
            return;
        }
        activeNode = mounter(makeCtx(top.userData));
        applyNavMusic(nodeName);
        gameBusEmit('nav_changed', { nodeName });
        refreshChromeGuide();
        gameBusEmit('session_updated');
    };

    function makeCtx(userData: unknown): NodeMountContext {
        return {
            scene,
            host: root,
            content,
            width,
            height,
            bgWidth: BG_WIDTH,
            bgHeight: BG_HEIGHT,
            bgBottomY,
            toScreenX,
            toScreenY: (localY: number) => toScreenY(localY) + CONTENT_Y_NUDGE,
            setTitle,
            setRightEnabled,
            setLeftEnabled,
            forward,
            back,
            replace,
            rootTo,
            userData,
            showToast,
        };
    }

    function forward(nodeName: string, userData?: unknown): void {
        const stack = getStack();
        stack.push({ nodeName, userData });
        persistStack(stack);
        mountCurrent();
    }

    function back(): void {
        const stack = getStack();
        if (stack.length <= 1) {
            rootTo(NavNode.HOME);
            return;
        }
        stack.pop();
        persistStack(stack);
        mountCurrent();
    }

    function replace(nodeName: string, userData?: unknown): void {
        const stack = getStack();
        if (stack.length === 0) {
            stack.push({ nodeName, userData });
        } else {
            stack[stack.length - 1] = { nodeName, userData };
        }
        persistStack(stack);
        mountCurrent();
    }

    function rootTo(nodeName: string, userData?: unknown): void {
        persistStack([{ nodeName, userData }]);
        mountCurrent();
    }

    // Initial mount from saved stack.
    mountCurrent();

    const stopGuideListener = onGuideChanged(refreshChromeGuide);

    return {
        root,
        forward,
        back,
        replace,
        rootTo,
        currentName: () => {
            const stack = getStack();
            return stack[stack.length - 1]?.nodeName ?? NavNode.HOME;
        },
        update: (deltaMs: number) => {
            activeNode?.update?.(deltaMs);
        },
        destroy: () => {
            if (destroyed) {
                return;
            }
            destroyed = true;
            stopGuideListener();
            chromeGuideWarn?.destroy();
            chromeGuideWarn = null;
            clearContent();
            root.destroy(true);
        },
    };
}

