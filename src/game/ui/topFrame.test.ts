import { describe, expect, mock, test } from 'bun:test';
import type { GameObjects, Scene, Types } from 'phaser';

mock.module('phaser', () => ({ GameObjects: {} }));

const { animateAttrFill } = await import('./topFrame');

type TweenConfig = Types.Tweens.TweenBuilderConfig;
type AttrFillEntry = Parameters<typeof animateAttrFill>[1];

function createImage(name = '') {
    const image = {
        name,
        x: 0,
        y: 0,
        depth: 0,
        displayWidth: 42,
        displayHeight: 42,
        parentContainer: null,
        frame: { realWidth: 84, realHeight: 84 },
        destroy: () => {},
        setCrop: () => image,
        setDepth: () => image,
        setName: (nextName: string) => {
            image.name = nextName;
            return image;
        },
        setOrigin: () => image,
        setScale: () => image,
        setVisible: () => image,
    };
    return image;
}

function createAnimationHarness() {
    const addedTweens: TweenConfig[] = [];
    const killedTargets: object[] = [];
    const fill = createImage('fill');
    const base = createImage('base');
    const scene = {
        add: {
            image: () => createImage(),
        },
        children: { list: [] },
        textures: {
            exists: () => true,
            get: () => ({ has: () => true }),
        },
        tweens: {
            add: (config: TweenConfig) => {
                addedTweens.push(config);
                return {};
            },
            killTweensOf: (target: object) => {
                killedTargets.push(target);
                return scene.tweens;
            },
        },
    };
    const entry: AttrFillEntry = {
        fill: fill as unknown as GameObjects.Image,
        base: base as unknown as GameObjects.Image,
        reverse: false,
        displayRatio: 0.5,
        targetRatio: 0.5,
        tweenProxy: null,
    };
    return {
        addedTweens,
        entry,
        killedTargets,
        scene: scene as unknown as Scene,
    };
}

describe('top frame attribute animation', () => {
    test('keeps an active tween when broad refreshes repeat the same target', () => {
        const harness = createAnimationHarness();

        animateAttrFill(harness.scene, harness.entry, 0.75, true);
        const initialProxy = harness.entry.tweenProxy;
        expect(initialProxy).not.toBeNull();
        expect(harness.addedTweens).toHaveLength(2);

        animateAttrFill(harness.scene, harness.entry, 0.75, true);

        expect(harness.entry.tweenProxy).toBe(initialProxy);
        expect(harness.killedTargets).toHaveLength(0);
        expect(harness.addedTweens).toHaveLength(2);
    });

    test('retargets a changed value from the currently displayed ratio', () => {
        const harness = createAnimationHarness();
        animateAttrFill(harness.scene, harness.entry, 0.75, true);
        const initialProxy = harness.entry.tweenProxy!;
        initialProxy.ratio = 0.6;
        const fillTween = harness.addedTweens.find((config) => config.duration === 420)!;
        fillTween.onUpdate?.({} as never, initialProxy, 'ratio', 0.6, 0.5);
        expect(harness.entry.displayRatio).toBe(0.6);

        animateAttrFill(harness.scene, harness.entry, 0.4, true);

        expect(harness.killedTargets).toEqual([initialProxy]);
        const replacementProxy = harness.entry.tweenProxy;
        expect(replacementProxy?.ratio).toBe(0.6);
        expect(harness.addedTweens).toHaveLength(4);

        initialProxy.ratio = 0.7;
        fillTween.onUpdate?.({} as never, initialProxy, 'ratio', 0.7, 0.6);
        fillTween.onComplete?.({} as never, initialProxy);

        expect(harness.entry.displayRatio).toBe(0.6);
        expect(harness.entry.targetRatio).toBe(0.4);
        expect(harness.entry.tweenProxy).toBe(replacementProxy);
    });
});
