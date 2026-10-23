import { useSyncExternalStore } from 'react';

// Everything in a workspace is a block. A page is a block whose children are
// the blocks rendered on it; sub-pages are page blocks inside another page.
export type BlockType =
  | 'page'
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
  icon?: string;
  children: string[];
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface State {
  version: 1;
  blocks: Record<string, Block>;
  rootPages: string[];
  activePageId: string | null;
}

export type BlockInit = Partial<Pick<Block, 'type' | 'text' | 'checked' | 'icon'>>;
export type DropPosition = 'before' | 'after';

const STORAGE_KEY = 'waltion:v1';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyState(): State {
  return { version: 1, blocks: {}, rootPages: [], activePageId: null };
}

function makeBlock(parentId: string | null, init: BlockInit = {}): Block {
  const now = Date.now();
  return { id: uid(), type: 'text', text: '', children: [], parentId, createdAt: now, updatedAt: now, ...init };
}

class Draft {
  blocks: Record<string, Block>;
  rootPages: string[];
  activePageId: string | null;

  constructor(s: State) {
    this.blocks = { ...s.blocks };
    this.rootPages = [...s.rootPages];
    this.activePageId = s.activePageId;
  }

  patch(id: string, patch: Partial<Block>) {
    const b = this.blocks[id];
    if (b) this.blocks[id] = { ...b, ...patch, updatedAt: Date.now() };
  }

  siblings(parentId: string | null): string[] {
    return parentId ? this.blocks[parentId]?.children ?? [] : this.rootPages;
  }

  setSiblings(parentId: string | null, ids: string[]) {
    if (parentId) this.patch(parentId, { children: ids });
    else this.rootPages = ids;
  }

  insert(block: Block, index?: number) {
    this.blocks[block.id] = block;
    const sibs = [...this.siblings(block.parentId)];
    sibs.splice(index === undefined || index < 0 ? sibs.length : index, 0, block.id);
    this.setSiblings(block.parentId, sibs);
  }

  detach(id: string) {
    const b = this.blocks[id];
    if (!b) return;
    this.setSiblings(b.parentId, this.siblings(b.parentId).filter((x) => x !== id));
  }

  isAncestor(ancestorId: string, id: string): boolean {
    for (let cur = this.blocks[id]?.parentId; cur; cur = this.blocks[cur]?.parentId ?? null) {
      if (cur === ancestorId) return true;
    }
    return false;
  }

  toState(): State {
    return { version: 1, blocks: this.blocks, rootPages: this.rootPages, activePageId: this.activePageId };
  }
}

export function createStore(initial: State, persist = false) {
  let state = initial;
  const listeners = new Set<() => void>();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function save() {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage may be unavailable (private mode, quota); keep working in memory.
    }
  }

  function edit<T>(fn: (d: Draft) => T): T {
    const d = new Draft(state);
    const result = fn(d);
    state = d.toState();
    if (persist) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 250);
    }
    listeners.forEach((l) => l());
    return result;
  }

  const actions = {
    createPage(parentId: string | null, title = '', afterId?: string): string {
      return edit((d) => {
        const page = makeBlock(parentId, { type: 'page', text: title });
        const first = makeBlock(page.id);
        page.children = [first.id];
        d.blocks[first.id] = first;
        const idx = afterId ? d.siblings(parentId).indexOf(afterId) : -1;
        d.insert(page, idx >= 0 ? idx + 1 : undefined);
        return page.id;
      });
    },

    updateBlock(id: string, patch: Partial<Omit<Block, 'id' | 'parentId' | 'children'>>) {
      edit((d) => d.patch(id, patch));
    },

    insertAfter(afterId: string, init: BlockInit = {}): string {
      return edit((d) => {
        const parentId = d.blocks[afterId].parentId;
        const b = makeBlock(parentId, init);
        d.insert(b, d.siblings(parentId).indexOf(afterId) + 1);
        return b.id;
      });
    },

    insertBefore(beforeId: string, init: BlockInit = {}): string {
      return edit((d) => {
        const parentId = d.blocks[beforeId].parentId;
        const b = makeBlock(parentId, init);
        d.insert(b, d.siblings(parentId).indexOf(beforeId));
        return b.id;
      });
    },

    appendBlock(parentId: string, init: BlockInit = {}, index?: number): string {
      return edit((d) => {
        const b = makeBlock(parentId, init);
        d.insert(b, index);
        return b.id;
      });
    },

    deleteBlock(id: string) {
      edit((d) => {
        const target = d.blocks[id];
        if (!target) return;
        d.detach(id);
        const removed = new Set<string>();
        const stack = [id];
        while (stack.length) {
          const cur = stack.pop()!;
          removed.add(cur);
          stack.push(...(d.blocks[cur]?.children ?? []));
          delete d.blocks[cur];
        }
        if (d.activePageId && removed.has(d.activePageId)) {
          d.activePageId = target.parentId ?? d.rootPages[0] ?? null;
        }
      });
    },

    moveBlock(id: string, targetId: string, position: DropPosition) {
      edit((d) => {
        if (id === targetId || !d.blocks[id] || !d.blocks[targetId] || d.isAncestor(id, targetId)) return;
        d.detach(id);
        const parentId = d.blocks[targetId].parentId;
        const sibs = [...d.siblings(parentId)];
        const idx = sibs.indexOf(targetId) + (position === 'after' ? 1 : 0);
        sibs.splice(idx, 0, id);
        d.setSiblings(parentId, sibs);
        d.patch(id, { parentId });
      });
    },

    duplicateBlock(id: string): string {
      return edit((d) => {
        const clone = (srcId: string, parentId: string | null): string => {
          const src = d.blocks[srcId];
          const copy: Block = { ...src, id: uid(), parentId, createdAt: Date.now(), updatedAt: Date.now() };
          copy.children = src.children.map((c) => clone(c, copy.id));
          d.blocks[copy.id] = copy;
          return copy.id;
        };
        const src = d.blocks[id];
        const copyId = clone(id, src.parentId);
        const sibs = [...d.siblings(src.parentId)];
        sibs.splice(sibs.indexOf(id) + 1, 0, copyId);
        d.setSiblings(src.parentId, sibs);
        return copyId;
      });
    },

    setActivePage(id: string | null) {
      if (state.activePageId === id) return;
      edit((d) => {
        d.activePageId = id && d.blocks[id] ? id : d.rootPages[0] ?? null;
      });
    },

    replaceState(next: State) {
      edit((d) => {
        d.blocks = next.blocks;
        d.rootPages = next.rootPages;
        d.activePageId = next.activePageId ?? next.rootPages[0] ?? null;
      });
    },
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush: () => persist && saveTimer !== undefined && save(),
    actions,
  };
}

export type Store = ReturnType<typeof createStore>;

export function isValidState(value: unknown): value is State {
  const s = value as State;
  return !!s && s.version === 1 && typeof s.blocks === 'object' && Array.isArray(s.rootPages);
}

/** Nearest page that contains the block (or the block itself if it is a page). */
export function owningPage(s: State, id: string): string | null {
  for (let cur: string | null = id; cur; cur = s.blocks[cur]?.parentId ?? null) {
    if (s.blocks[cur]?.type === 'page') return cur;
  }
  return null;
}

export function pageAncestors(s: State, pageId: string): string[] {
  const chain: string[] = [];
  for (let cur: string | null = pageId; cur; cur = s.blocks[cur]?.parentId ?? null) chain.unshift(cur);
  return chain;
}

export function seedState(): State {
  const s = createStore(emptyState());
  const a = s.actions;
  const welcome = a.createPage(null, 'Welcome to Waltion');
  a.updateBlock(welcome, { icon: '👋' });
  const first = s.getState().blocks[welcome].children[0];
  a.updateBlock(first, {
    text: 'Waltion is an open-source, local-first workspace. Everything you write stays in this browser.',
  });
  let last = first;
  const add = (init: BlockInit) => (last = a.insertAfter(last, init));
  add({ type: 'h2', text: 'The basics' });
  add({ type: 'bullet', text: "Type '/' anywhere to insert a block." });
  add({ type: 'bullet', text: 'Markdown shortcuts work: #, ##, ###, -, 1., [], >, ``` and ---.' });
  add({ type: 'bullet', text: 'Drag the ⋮⋮ handle to reorder blocks. Click it for more options.' });
  add({ type: 'bullet', text: 'Press Ctrl/⌘ + K to search every page.' });
  add({ type: 'callout', icon: '💡', text: 'Paste Markdown and Waltion turns each line into a block.' });
  add({ type: 'divider' });
  const sub = a.createPage(welcome, 'Getting started', last);
  a.updateBlock(sub, { icon: '✅' });
  const subFirst = s.getState().blocks[sub].children[0];
  a.updateBlock(subFirst, { type: 'todo', text: 'Create your first page', checked: true });
  let t = subFirst;
  t = a.insertAfter(t, { type: 'todo', text: 'Try the / command menu' });
  t = a.insertAfter(t, { type: 'todo', text: 'Export a page to Markdown' });
  a.insertAfter(t, { type: 'todo', text: 'Star Waltion on GitHub' });
  a.setActivePage(welcome);
  return s.getState();
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) return parsed;
    }
  } catch {
    // Fall through to a fresh workspace.
  }
  return seedState();
}

export const store = createStore(loadState(), true);
export const actions = store.actions;

if (typeof window !== 'undefined') window.addEventListener('beforeunload', () => store.flush());

export function useWaltion<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
