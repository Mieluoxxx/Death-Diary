/**
 * RadioNode — local cheat console replacing the original online radio.
 *
 * Commands:
 *   /list
 *   /get <id> <number>
 *   /getall <number>
 *
 * Scroll model mirrors storageNode:
 * - fixed viewport under title line / above input
 * - GeometryMask on a content container
 * - drag + wheel move the container, never draw outside the well
 */

import { mutateSession, type ItemCounts } from '../../session/sessionStore';
import {
    radioGroupedListText,
    radioItemIds,
    radioItemName,
    RADIO_ITEM_CATALOG,
} from '../../data/radioItemCatalog';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
    uiWordWrap,
} from '../uiFont';

/**
 * Content well in Cocos local y-up (via ctx.toScreenY, which already adds CONTENT_Y_NUDGE).
 * Title bar ~803, frame_line ~770 → start log just under the line.
 * Input bar at ~52; leave a gap so text never covers the input.
 */
const LOG_LOCAL_TOP = 740;
const LOG_LOCAL_BOTTOM = 100;
const LOG_PAD_X = 28;
const LOG_WIDTH = 540;
const INPUT_LOCAL_Y = 52;
const INPUT_WIDTH = 548;
const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER;

function parsePositiveAmount (raw: string): number | null
{
    if (!/^\d+$/.test(raw))
    {
        return null;
    }
    const amount = Number(raw);
    return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_SAFE_AMOUNT
        ? amount
        : null;
}

function addCounts (storage: ItemCounts, itemId: number, amount: number): void
{
    storage[itemId] = (storage[itemId] ?? 0) + amount;
}

export function mountRadioNode (ctx: NodeMountContext): NodeMountResult
{
    ctx.setTitle('电台');
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    const logX = ctx.toScreenX(LOG_PAD_X);
    const viewTop = ctx.toScreenY(LOG_LOCAL_TOP);
    const viewBottom = ctx.toScreenY(LOG_LOCAL_BOTTOM);
    const viewH = Math.max(120, viewBottom - viewTop);
    const viewW = LOG_WIDTH;
    const inputY = ctx.toScreenY(INPUT_LOCAL_Y);

    // Opaque well: hides home map / chrome under the scroll area only.
    const well = ctx.scene.add
        .rectangle(logX + viewW / 2, viewTop + viewH / 2, viewW + 12, viewH + 8, 0x000000, 1)
        .setOrigin(0.5);
    ctx.content.add(well);

    // Phaser 4 GeometryMask is Canvas-only; WebGL needs FilterMask.
    // Fixed world-space viewport so scrolling content is clipped to the log well.
    const maskRect = ctx.scene.add
        .rectangle(logX + viewW / 2, viewTop + viewH / 2, viewW, viewH, 0xffffff)
        .setVisible(false);

    // Scrollable content lives in this container; only this is filtered.
    const listRoot = ctx.scene.add.container(logX, viewTop);
    listRoot.enableFilters();
    if (listRoot.filters)
    {
        listRoot.filters.internal.addMask(
            maskRect,
            false,
            ctx.scene.cameras.main,
            'world',
        );
    }
    ctx.content.add(listRoot);

    const logText = ctx.scene.add
        .text(0, 0, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#ffffff',
            lineSpacing: 4,
            wordWrap: uiWordWrap(viewW),
        })
        .setOrigin(0, 0);
    listRoot.add(logText);

    const inputBg = ctx.scene.add
        .rectangle(ctx.toScreenX(298), inputY, INPUT_WIDTH, 48, 0xeeeeee)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
    ctx.content.add(inputBg);

    let inputValue = '';
    let contentH = 0;
    let dragBaseY = viewTop;
    let dragStartPointerY = 0;
    let dragging = false;
    let didDrag = false;

    const inputText = ctx.scene.add
        .text(ctx.toScreenX(28), inputY, '> ', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#111111',
        })
        .setOrigin(0, 0.5);
    ctx.content.add(inputText);

    const repaintInput = () => inputText.setText(`> ${inputValue}`);

    const clampOffset = () =>
    {
        // listRoot.y is absolute screen y of content top.
        // Content top may not go below viewTop; may not go above viewTop+(viewH-contentH).
        const minY = viewTop + Math.min(0, viewH - contentH);
        const maxY = viewTop;
        listRoot.y = Math.max(minY, Math.min(maxY, listRoot.y));
    };

    const syncContentHeight = () =>
    {
        contentH = Math.max(logText.height + 8, viewH);
        clampOffset();
    };

    const inView = (x: number, y: number) =>
        x >= logX
        && x <= logX + viewW
        && y >= viewTop
        && y <= viewTop + viewH;

    const setBody = (message: string, stickBottom = false) =>
    {
        logText.setText(message);
        syncContentHeight();
        if (stickBottom)
        {
            listRoot.y = viewTop + Math.min(0, viewH - contentH);
            clampOffset();
        }
        else
        {
            // /list starts at the first group; drag / wheel reveals the rest.
            listRoot.y = viewTop;
            clampOffset();
        }
    };

    const appendOutput = (message: string, stickBottom = true) =>
    {
        const current = logText.text;
        setBody(current ? `${current}\n\n${message}` : message, stickBottom);
    };

    const runCommand = (rawCommand: string) =>
    {
        // "/get all 100" is a common typo for "/getall 100".
        const command = rawCommand
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/^\/get\s+all\b/i, '/getall');

        if (command === '/list')
        {
            setBody(
                '电台作弊终端\n'
                + '/list  /get <id> <数量>  /getall <数量>\n\n'
                + radioGroupedListText(),
                false,
            );
            return;
        }

        const getMatch = /^\/get\s+(\d+)\s+(\S+)$/i.exec(command);
        if (getMatch)
        {
            const itemId = Number(getMatch[1]);
            const amount = parsePositiveAmount(getMatch[2]!);
            if (!amount)
            {
                appendOutput('数量必须是正整数。');
                return;
            }
            if (!RADIO_ITEM_CATALOG[itemId])
            {
                appendOutput(`未知物品编号：${itemId}。先用 /list 查询。`);
                return;
            }
            mutateSession((session) => addCounts(session.storage, itemId, amount));
            appendOutput(`已获得 ${radioItemName(itemId)} × ${amount}（${itemId}）。`);
            return;
        }

        const getAllMatch = /^\/getall\s+(\S+)$/i.exec(command);
        if (getAllMatch)
        {
            const amount = parsePositiveAmount(getAllMatch[1]!);
            if (!amount)
            {
                appendOutput('数量必须是正整数。');
                return;
            }
            const itemIds = radioItemIds();
            mutateSession((session) =>
            {
                for (const itemId of itemIds)
                {
                    addCounts(session.storage, itemId, amount);
                }
            });
            appendOutput(`已获得全部 ${itemIds.length} 种物品，各 × ${amount}。`);
            return;
        }

        appendOutput('未知指令。可用：/list、/get <id> <数量>、/getall <数量>。');
    };

    const keyboard = ctx.scene.input.keyboard;
    const onKeyDown = (event: KeyboardEvent) =>
    {
        if (event.key === 'Enter')
        {
            if (inputValue.trim())
            {
                const command = inputValue;
                appendOutput(`> ${command}`);
                runCommand(command);
                inputValue = '';
                repaintInput();
            }
            event.preventDefault();
            return;
        }
        if (event.key === 'Backspace')
        {
            inputValue = inputValue.slice(0, -1);
            repaintInput();
            event.preventDefault();
            return;
        }
        if (event.key.length === 1 && inputValue.length < 120)
        {
            inputValue += event.key;
            repaintInput();
            event.preventDefault();
        }
    };
    keyboard?.on('keydown', onKeyDown);

    const onPointerDown = (pointer: Phaser.Input.Pointer) =>
    {
        if (!inView(pointer.x, pointer.y))
        {
            return;
        }
        dragging = true;
        didDrag = false;
        dragBaseY = listRoot.y;
        dragStartPointerY = pointer.y;
    };
    const onPointerMove = (pointer: Phaser.Input.Pointer) =>
    {
        if (!dragging || !pointer.isDown)
        {
            return;
        }
        const dy = pointer.y - dragStartPointerY;
        if (Math.abs(dy) > 6)
        {
            didDrag = true;
        }
        if (didDrag)
        {
            listRoot.y = dragBaseY + dy;
            clampOffset();
        }
    };
    const onPointerUp = () =>
    {
        dragging = false;
    };
    const onWheel = (
        pointer: Phaser.Input.Pointer,
        _gos: unknown,
        _dx: number,
        dy: number,
    ) =>
    {
        if (!inView(pointer.x, pointer.y))
        {
            return;
        }
        listRoot.y -= dy * 0.5;
        clampOffset();
    };

    ctx.scene.input.on('pointerdown', onPointerDown);
    ctx.scene.input.on('pointermove', onPointerMove);
    ctx.scene.input.on('pointerup', onPointerUp);
    ctx.scene.input.on('wheel', onWheel);

    setBody(
        '电台已改为本地作弊终端。\n'
        + `/list：按类别列出全部物品和编号（共 ${radioItemIds().length} 种）\n`
        + '/get <id> <数量>：获得指定物品\n'
        + '/getall <数量>：获得全部物品\n'
        + '\n（区域内可拖动 / 滚轮滚动）',
        false,
    );

    return {
        destroy: () =>
        {
            keyboard?.off('keydown', onKeyDown);
            ctx.scene.input.off('pointerdown', onPointerDown);
            ctx.scene.input.off('pointermove', onPointerMove);
            ctx.scene.input.off('pointerup', onPointerUp);
            ctx.scene.input.off('wheel', onWheel);
            listRoot.filters?.internal.clear();
            maskRect.destroy();
        },
    };
}
