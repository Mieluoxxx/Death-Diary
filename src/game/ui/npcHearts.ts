import type { GameObjects, Scene } from 'phaser';

const HEART_COUNT = 5;
const HEART_WIDTH = 22;
const HEART_HEIGHT = 18;
const HEART_GAP = 5;

export type NpcHearts = GameObjects.Container & {
    setReputation: (reputation: number) => void;
};

/** Five original half-heart slots, positioned from the supplied right edge. */
export function addNpcHearts(
    scene: Scene,
    parent: GameObjects.Container,
    right: number,
    y: number,
    reputation: number,
    name = 'npcHearts',
): NpcHearts {
    const width = HEART_COUNT * HEART_WIDTH + (HEART_COUNT - 1) * HEART_GAP;
    const fills: GameObjects.Image[] = [];
    const root = scene.add.container(right - width, y).setName(name) as NpcHearts;
    root.setSize(width, HEART_HEIGHT);

    for (let i = 0; i < HEART_COUNT; i += 1) {
        const x = i * (HEART_WIDTH + HEART_GAP);
        root.add(
            scene.add
                .image(x, 0, 'icon', 'icon_heart_bg.png')
                .setOrigin(0, 0.5)
                .setName(`${name}Background${i + 1}`),
        );
        const fill = scene.add
            .image(x, 0, 'icon', 'icon_heart_full.png')
            .setOrigin(0, 0.5)
            .setName(`${name}Fill${i + 1}`);
        root.add(fill);
        fills.push(fill);
    }

    root.setReputation = (value: number) => {
        const hearts = Math.max(0, Math.min(HEART_COUNT * 2, Math.floor(value)));
        const full = Math.floor(hearts / 2);
        const half = hearts % 2 === 1;
        fills.forEach((fill, index) => {
            fill.setVisible(index < full || (half && index === full));
            fill.setFrame(index < full ? 'icon_heart_full.png' : 'icon_heart_half.png');
            // setFrame resets origin to the frame pivot (0.5); re-assert left alignment.
            fill.setOrigin(0, 0.5);
        });
    };
    root.setReputation(reputation);
    parent.add(root);
    return root;
}
