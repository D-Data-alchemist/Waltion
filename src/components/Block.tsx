import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { actions, store, useWaltion } from '../lib/store';
import type { BlockType } from '../lib/store';
import { focusBlock, getCaret, selectionCollapsed } from '../lib/caret';
import { LINE_PREFIXES, parseMarkdownLine } from '../lib/markdown';
import { COMMANDS, filterCommands } from '../lib/commands';
import { SlashMenu } from './SlashMenu';

const DRAG_MIME = 'application/x-waltion-block';
const CONTINUING: ReadonlySet<BlockType> = new Set(['bullet', 'numbered', 'todo']);
const NON_EDITABLE: ReadonlySet<BlockType> = new Set(['page', 'divider']);

const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  text: "Type '/' for commands",
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  bullet: 'List',
  numbered: 'List',
  todo: 'To-do',
  quote: 'Empty quote',
  callout: 'Type something…',
  code: 'Code',
};

interface SlashState {
  query: string;
  start: number;
  index: number;
}

function siblingOf(id: string, delta: number): string | null {
  const s = store.getState();
  const parentId = s.blocks[id]?.parentId;
  if (!parentId) return null;
  const sibs = s.blocks[parentId].children;
  return sibs[sibs.indexOf(id) + delta] ?? null;
}

function focusNeighbour(id: string, delta: -1 | 1): boolean {
  const target = siblingOf(id, delta);
  if (target) {
    focusBlock(target, delta < 0 ? 'end' : 0);
    return true;
  }
  if (delta < 0) {
    const pageId = store.getState().blocks[id]?.parentId;
    if (pageId) focusBlock(`title:${pageId}`, 'end');
    return true;
  }
  return false;
}

export function BlockRow({ id, number }: { id: string; number: number }) {
  const block = useWaltion((s) => s.blocks[id]);
  const rowRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [drop, setDrop] = useState<'before' | 'after' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // contentEditable is uncontrolled: only write to the DOM when the store
  // changes from somewhere other than the user's typing.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && block && el.textContent !== block.text) el.textContent = block.text;
  }, [block?.text, block?.type]);

  if (!block) return null;

  const updateSlash = (el: HTMLElement, text: string) => {
    if (block.type === 'code') return setSlash(null);
    const caret = getCaret(el);
    const m = text.slice(0, caret).match(/(?:^|\s)\/([\w-]*)$/);
    setSlash(m ? { query: m[1], start: caret - m[1].length - 1, index: 0 } : null);
  };

  const onInput = () => {
    const el = ref.current!;
    const text = el.textContent ?? '';
    if (text === '' && el.innerHTML !== '') el.innerHTML = '';

    if (block.type === 'text') {
      if (text === '---') {
        actions.updateBlock(id, { type: 'divider', text: '' });
        focusBlock(actions.insertAfter(id));
        return;
      }
      for (const [re, init] of LINE_PREFIXES) {
        const m = text.match(re);
        if (m && getCaret(el) === m[0].length) {
          actions.updateBlock(id, { ...init, text: text.slice(m[0].length) });
          setSlash(null);
          focusBlock(id, 0);
          return;
        }
      }
    }
    actions.updateBlock(id, { text });
    updateSlash(el, text);
  };

  const applyCommand = (type: BlockType) => {
    const el = ref.current!;
    const text = el.textContent ?? '';
    const s = slash!;
    const rest = text.slice(0, s.start) + text.slice(s.start + 1 + s.query.length);
    setSlash(null);

    if (type === 'page') {
      const pageId = actions.createPage(block.parentId, '', id);
      if (rest.trim() === '') actions.deleteBlock(id);
      else actions.updateBlock(id, { text: rest });
      actions.setActivePage(pageId);
      focusBlock(`title:${pageId}`);
      return;
    }
    if (type === 'divider') {
      if (rest.trim() === '') {
        actions.updateBlock(id, { type: 'divider', text: '' });
        focusBlock(actions.insertAfter(id));
      } else {
        actions.updateBlock(id, { text: rest });
        focusBlock(actions.insertAfter(actions.insertAfter(id, { type: 'divider' })));
      }
      return;
    }
    actions.updateBlock(id, { type, text: rest, ...(type === 'callout' && !block.icon ? { icon: '💡' } : {}) });
    focusBlock(id, s.start);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current!;
    const items = slash ? filterCommands(slash.query) : [];
    if (slash && items.length === 0 && (e.key === 'Enter' || e.key === 'Escape')) setSlash(null);
    if (slash && items.length > 0) {
      const n = items.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSlash({ ...slash, index: (slash.index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyCommand(items[slash.index].type);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }

    const text = el.textContent ?? '';
    const caret = getCaret(el);
    const collapsed = selectionCollapsed();

    if (e.key === 'Enter') {
      e.preventDefault();
      const mod = e.metaKey || e.ctrlKey;
      if (e.shiftKey || (block.type === 'code' && !mod)) {
        document.execCommand('insertText', false, '\n');
        return;
      }
      if (text === '' && CONTINUING.has(block.type)) {
        actions.updateBlock(id, { type: 'text' });
        focusBlock(id, 0);
        return;
      }
      if (caret === 0 && text !== '' && block.type !== 'code') {
        actions.insertBefore(id, { type: CONTINUING.has(block.type) ? block.type : 'text' });
        return;
      }
      const after = block.type === 'code' ? '' : text.slice(caret);
      if (after) actions.updateBlock(id, { text: text.slice(0, caret) });
      const nextType = CONTINUING.has(block.type) ? block.type : 'text';
      focusBlock(actions.insertAfter(id, { type: nextType, text: after }), 0);
      return;
    }

    if (e.key === 'Backspace' && collapsed && caret === 0) {
      if (block.type !== 'text') {
        e.preventDefault();
        actions.updateBlock(id, { type: 'text' });
        focusBlock(id, 0);
        return;
      }
      const prevId = siblingOf(id, -1);
      if (!prevId) {
        if (text === '' && siblingOf(id, 1)) {
          e.preventDefault();
          actions.deleteBlock(id);
          focusBlock(`title:${block.parentId}`, 'end');
        }
        return;
      }
      e.preventDefault();
      const prev = store.getState().blocks[prevId];
      if (prev.type === 'divider') {
        actions.deleteBlock(prevId);
        return;
      }
      if (prev.type === 'page') {
        if (text === '') actions.deleteBlock(id);
        focusBlock(prevId);
        return;
      }
      actions.updateBlock(prevId, { text: prev.text + text });
      actions.deleteBlock(id);
      focusBlock(prevId, prev.text.length);
      return;
    }

    if (e.key === 'Delete' && collapsed && caret === text.length) {
      const nextId = siblingOf(id, 1);
      const next = nextId ? store.getState().blocks[nextId] : null;
      if (!next || next.type === 'page') return;
      e.preventDefault();
      actions.updateBlock(id, { text: text + next.text });
      actions.deleteBlock(next.id);
      focusBlock(id, text.length);
      return;
    }

    if (e.key === 'ArrowUp' && !text.slice(0, caret).includes('\n')) {
      if (focusNeighbour(id, -1)) e.preventDefault();
    } else if (e.key === 'ArrowDown' && !text.slice(caret).includes('\n')) {
      if (focusNeighbour(id, 1)) e.preventDefault();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const pasted = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    if (!pasted) return;
    e.preventDefault();
    if (block.type === 'code' || !pasted.includes('\n')) {
      document.execCommand('insertText', false, pasted);
      return;
    }
    const el = ref.current!;
    const text = el.textContent ?? '';
    const caret = getCaret(el);
    const [first, ...lines] = pasted.split('\n');
    actions.updateBlock(id, { text: text.slice(0, caret) + first });
    let last = id;
    for (const line of lines) if (line.trim() !== '') last = actions.insertAfter(last, parseMarkdownLine(line));
    const lastText = store.getState().blocks[last].text;
    actions.updateBlock(last, { text: lastText + text.slice(caret) });
    focusBlock(last, lastText.length);
  };

  // Drag and drop between blocks on the same page.
  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    const r = rowRef.current!.getBoundingClientRect();
    setDrop(e.clientY < r.top + r.height / 2 ? 'before' : 'after');
  };
  const onDrop = (e: DragEvent) => {
    const src = e.dataTransfer.getData(DRAG_MIME);
    if (!src) return;
    e.preventDefault();
    actions.moveBlock(src, id, drop ?? 'after');
    setDrop(null);
  };

  const editable = (
    <div
      ref={ref}
      className="editable"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-editable={id}
      data-placeholder={PLACEHOLDERS[block.type]}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onBlur={() => setSlash(null)}
      onKeyUp={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') updateSlash(ref.current!, ref.current!.textContent ?? '');
      }}
    />
  );

  let body;
  switch (block.type) {
    case 'page':
      body = (
        <div
          key="page"
          className="page-link"
          tabIndex={0}
          data-editable={id}
          onClick={() => actions.setActivePage(id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') actions.setActivePage(id);
            else if (e.key === 'ArrowUp' && focusNeighbour(id, -1)) e.preventDefault();
            else if (e.key === 'ArrowDown' && focusNeighbour(id, 1)) e.preventDefault();
          }}
        >
          <span className="page-link-icon">{block.icon ?? '📄'}</span>
          <span className="page-link-title">{block.text || 'Untitled'}</span>
        </div>
      );
      break;
    case 'divider':
      body = (
        <div
          key="divider"
          className="divider"
          tabIndex={0}
          data-editable={id}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
              e.preventDefault();
              focusNeighbour(id, -1);
              actions.deleteBlock(id);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              focusBlock(actions.insertAfter(id));
            } else if (e.key === 'ArrowUp' && focusNeighbour(id, -1)) e.preventDefault();
            else if (e.key === 'ArrowDown' && focusNeighbour(id, 1)) e.preventDefault();
          }}
        >
          <hr />
        </div>
      );
      break;
    default: {
      // Every editable type shares one structure (prefix slot + editable) so
      // changing type never remounts the uncontrolled contentEditable.
      let prefix = null;
      if (block.type === 'todo') {
        prefix = (
          <input
            type="checkbox"
            checked={!!block.checked}
            aria-label="Done"
            onChange={(e) => actions.updateBlock(id, { checked: e.target.checked })}
          />
        );
      } else if (block.type === 'bullet' || block.type === 'numbered') {
        prefix = <span className="marker">{block.type === 'bullet' ? '•' : `${number}.`}</span>;
      } else if (block.type === 'callout') {
        prefix = <span className="callout-icon">{block.icon ?? '💡'}</span>;
      }
      body = (
        <div key="editable" className={`inner${block.type === 'todo' && block.checked ? ' checked' : ''}`}>
          {prefix}
          {editable}
        </div>
      );
    }
  }

  return (
    <div
      ref={rowRef}
      className={`block-row type-${block.type}${drop ? ` drop-${drop}` : ''}`}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!rowRef.current?.contains(e.relatedTarget as Node)) setDrop(null);
      }}
      onDrop={onDrop}
    >
      <div className="gutter">
        <button
          className="gutter-btn"
          title="Add a block below"
          aria-label="Add a block below"
          onClick={() => focusBlock(actions.insertAfter(id))}
        >
          +
        </button>
        <button
          className="gutter-btn handle"
          title="Drag to move · Click for options"
          aria-label="Block options"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, id);
            e.dataTransfer.effectAllowed = 'move';
            if (rowRef.current) e.dataTransfer.setDragImage(rowRef.current, 0, 0);
          }}
          onClick={() => setMenuOpen((o) => !o)}
        >
          ⋮⋮
        </button>
        {menuOpen && <BlockMenu id={id} type={block.type} onClose={() => setMenuOpen(false)} />}
      </div>
      <div className="block-body">{body}</div>
      {slash && (
        <SlashMenu
          items={filterCommands(slash.query)}
          index={slash.index}
          onHover={(index) => setSlash({ ...slash, index })}
          onPick={applyCommand}
        />
      )}
    </div>
  );
}

function BlockMenu({ id, type, onClose }: { id: string; type: BlockType; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const turnInto = COMMANDS.filter((c) => !NON_EDITABLE.has(c.type) && c.type !== type);
  return (
    <div className="popover block-menu" ref={ref} role="menu">
      {!NON_EDITABLE.has(type) && (
        <>
          <div className="popover-label">Turn into</div>
          {turnInto.map((c) => (
            <button
              key={c.type}
              role="menuitem"
              className="popover-item"
              onClick={() => {
                actions.updateBlock(id, { type: c.type, ...(c.type === 'callout' ? { icon: '💡' } : {}) });
                onClose();
                focusBlock(id, 'end');
              }}
            >
              <span className="cmd-icon">{c.icon}</span>
              {c.label}
            </button>
          ))}
          <div className="popover-sep" />
        </>
      )}
      <button
        role="menuitem"
        className="popover-item"
        onClick={() => {
          actions.duplicateBlock(id);
          onClose();
        }}
      >
        <span className="cmd-icon">⧉</span>Duplicate
      </button>
      <button
        role="menuitem"
        className="popover-item danger"
        onClick={() => {
          const s = store.getState();
          if (type === 'page' && !confirm(`Delete “${s.blocks[id].text || 'Untitled'}” and everything in it?`)) return;
          onClose();
          actions.deleteBlock(id);
        }}
      >
        <span className="cmd-icon">🗑</span>Delete
      </button>
    </div>
  );
}
