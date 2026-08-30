/**
 * RadioNode — local cheat console replacing the original online radio.
 *
 * Commands:
 *   /list
 *   /get <id> <number>
 *   /getall <number>
 *
 * Log well scrolls via shared ScrollViewport.
 */

import {
    RADIO_ITEM_CATALOG,
    radioGroupedListText,
    radioItemIds,
    radioItemName,
} from '../../data/radioItemCatalog';
import { type ItemCounts, mutateSession } from '../../session/sessionStore';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { mountScrollViewport } from '../scrollViewport';
import { uiTextStyle, uiWordWrap } from '../uiFont';

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

function parsePositiveAmount(raw: string): number | null {
    if (!/^\d+$/.test(raw)) {
        return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > MAX_SAFE_AMOUNT) {
        return null;
    }
    return n;
}

function addCounts(storage: ItemCounts, itemId: number, amount: number): void {
    storage[itemId] = (storage[itemId] ?? 0) + amount;
}

export function mountRadioNode(ctx: NodeMountContext): NodeMountResult {
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

    const scroll = mountScrollViewport(ctx.scene, ctx.content, {
        x: logX,
        y: viewTop,
        width: viewW,
        height: viewH,
        axis: 'y',
        inputBlocker: true,
    });

    const logText = ctx.scene.add
        .text(0, 0, '', {
            ...uiTextStyle('COMMON_3'),
            color: '#ffffff',
            lineSpacing: 4,
            wordWrap: uiWordWrap(viewW),
        })
        .setOrigin(0, 0);
    scroll.content.add(logText);

    // Phaser canvas text cannot receive browser focus, so it can never open a
    // mobile IME. A DOM input is composited at the same scene coordinates and
    // still follows Phaser's FIT scaling through its DOM container.
    const commandInput = document.createElement('input');
    commandInput.className = 'radio-command-input';
    commandInput.type = 'text';
    commandInput.maxLength = 120;
    commandInput.autocomplete = 'off';
    commandInput.setAttribute('autocapitalize', 'off');
    commandInput.setAttribute('autocorrect', 'off');
    commandInput.setAttribute('spellcheck', 'false');
    commandInput.setAttribute('inputmode', 'text');
    commandInput.setAttribute('enterkeyhint', 'send');
    commandInput.setAttribute('aria-label', '电台指令');
    Object.assign(commandInput.style, {
        boxSizing: 'border-box',
        width: `${INPUT_WIDTH}px`,
        height: '48px',
        border: '2px solid #f4efe5',
        borderRadius: '0',
        outline: 'none',
        padding: '0 12px',
        background: '#050505',
        color: '#f4efe5',
        caretColor: '#f4efe5',
        boxShadow: 'inset 0 0 0 1px #2a2a2a',
        ...uiTextStyle('COMMON_3'),
        fontWeight: 'normal',
        lineHeight: '44px',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        touchAction: 'manipulation',
    });
    commandInput.placeholder = '> 输入 /list、/get 或 /getall';

    const input = ctx.scene.add.dom(ctx.toScreenX(298), inputY, commandInput);
    input.setDepth(150);
    let inputValue = '';

    const setBody = (message: string, stickBottom = false) => {
        logText.setText(message);
        const contentH = Math.max(logText.height + 8, viewH);
        scroll.setContentSize(contentH);
        if (stickBottom) {
            scroll.setOffset(Math.min(0, viewH - contentH));
        } else {
            // /list starts at the first group; drag / wheel reveals the rest.
            scroll.setOffset(0);
        }
    };

    const appendOutput = (message: string, stickBottom = true) => {
        const current = logText.text;
        setBody(current ? `${current}\n\n${message}` : message, stickBottom);
    };

    const runCommand = (rawCommand: string) => {
        // "/get all 100" is a common typo for "/getall 100".
        const command = rawCommand
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/^\/get\s+all\b/i, '/getall');

        if (command === '/list') {
            setBody(
                '电台作弊终端\n' +
                    '/list  /get <id> <数量>  /getall <数量>\n\n' +
                    radioGroupedListText(),
                false,
            );
            return;
        }

        const getMatch = /^\/get\s+(\d+)\s+(\S+)$/i.exec(command);
        if (getMatch) {
            const itemId = Number(getMatch[1]);
            const amount = parsePositiveAmount(getMatch[2]!);
            if (!amount) {
                appendOutput('数量必须是正整数。');
                return;
            }
            if (!RADIO_ITEM_CATALOG[itemId]) {
                appendOutput(`未知物品编号：${itemId}。先用 /list 查询。`);
                return;
            }
            mutateSession((session) => addCounts(session.storage, itemId, amount));
            appendOutput(`已获得 ${radioItemName(itemId)} × ${amount}（${itemId}）。`);
            return;
        }

        const getAllMatch = /^\/getall\s+(\S+)$/i.exec(command);
        if (getAllMatch) {
            const amount = parsePositiveAmount(getAllMatch[1]!);
            if (!amount) {
                appendOutput('数量必须是正整数。');
                return;
            }
            const itemIds = radioItemIds();
            mutateSession((session) => {
                for (const itemId of itemIds) {
                    addCounts(session.storage, itemId, amount);
                }
            });
            appendOutput(`已获得全部 ${itemIds.length} 种物品，各 × ${amount}。`);
            return;
        }

        appendOutput('未知指令。可用：/list、/get <id> <数量>、/getall <数量>。');
    };

    const onInput = () => {
        inputValue = commandInput.value;
    };
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.isComposing || event.key !== 'Enter') {
            return;
        }
        if (inputValue.trim()) {
            const command = inputValue;
            appendOutput(`> ${command}`);
            runCommand(command);
            inputValue = '';
            commandInput.value = '';
        }
        event.preventDefault();
    };
    commandInput.addEventListener('input', onInput);
    commandInput.addEventListener('keydown', onKeyDown);

    setBody(
        '电台已改为本地作弊终端。\n' +
            `/list：按类别列出全部物品和编号（共 ${radioItemIds().length} 种）\n` +
            '/get <id> <数量>：获得指定物品\n' +
            '/getall <数量>：获得全部物品\n' +
            '\n（区域内可拖动 / 滚轮滚动）',
        false,
    );

    return {
        destroy: () => {
            commandInput.removeEventListener('input', onInput);
            commandInput.removeEventListener('keydown', onKeyDown);
            input.destroy();
            scroll.destroy();
        },
    };
}
