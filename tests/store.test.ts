import { describe, expect, it } from 'vitest';
import { createStore, emptyState, owningPage, pageAncestors, seedState } from '../src/lib/store';
import { pageToMarkdown, parseMarkdownLine } from '../src/lib/markdown';

function setup() {
  const store = createStore(emptyState());
  const page = store.actions.createPage(null, 'Home');
  const first = store.getState().blocks[page].children[0];
  return { store, a: store.actions, page, first };
}

describe('store', () => {
  it('creates a page with one empty text block', () => {
    const { store, page, first } = setup();
    const s = store.getState();
    expect(s.rootPages).toEqual([page]);
    expect(s.blocks[page]).toMatchObject({ type: 'page', text: 'Home', children: [first] });
    expect(s.blocks[first]).toMatchObject({ type: 'text', text: '', parentId: page });
  });

  it('inserts blocks before and after', () => {
    const { store, a, page, first } = setup();
    const after = a.insertAfter(first, { type: 'h1', text: 'After' });
    const before = a.insertBefore(first, { text: 'Before' });
    expect(store.getState().blocks[page].children).toEqual([before, first, after]);
  });

  it('deletes a page with all of its descendants and moves focus to the parent', () => {
    const { store, a, page, first } = setup();
    const sub = a.createPage(page, 'Sub', first);
    const subBlock = store.getState().blocks[sub].children[0];
    a.setActivePage(sub);
    a.deleteBlock(sub);
    const s = store.getState();
    expect(s.blocks[sub]).toBeUndefined();
    expect(s.blocks[subBlock]).toBeUndefined();
    expect(s.blocks[page].children).toEqual([first]);
    expect(s.activePageId).toBe(page);
  });

  it('moves blocks and refuses to move a page into itself', () => {
    const { store, a, page, first } = setup();
    const b = a.insertAfter(first, { text: 'b' });
    const c = a.insertAfter(b, { text: 'c' });
    a.moveBlock(c, first, 'before');
    expect(store.getState().blocks[page].children).toEqual([c, first, b]);

    const sub = a.createPage(page, 'Sub');
    const inner = store.getState().blocks[sub].children[0];
    a.moveBlock(page, inner, 'after');
    expect(store.getState().rootPages).toEqual([page]);
  });

  it('duplicates a block tree with fresh ids', () => {
    const { store, a, page } = setup();
    const sub = a.createPage(page, 'Sub');
    const copy = a.duplicateBlock(sub);
    const s = store.getState();
    expect(copy).not.toBe(sub);
    expect(s.blocks[copy].text).toBe('Sub');
    expect(s.blocks[copy].children[0]).not.toBe(s.blocks[sub].children[0]);
    expect(s.blocks[s.blocks[copy].children[0]].parentId).toBe(copy);
  });

  it('finds owning pages and ancestors', () => {
    const { store, a, page } = setup();
    const sub = a.createPage(page, 'Sub');
    const inner = store.getState().blocks[sub].children[0];
    expect(owningPage(store.getState(), inner)).toBe(sub);
    expect(pageAncestors(store.getState(), sub)).toEqual([page, sub]);
  });

  it('seeds a welcome workspace', () => {
    const s = seedState();
    expect(s.rootPages).toHaveLength(1);
    expect(s.activePageId).toBe(s.rootPages[0]);
  });
});

describe('markdown', () => {
  it('parses line prefixes', () => {
    expect(parseMarkdownLine('# Title')).toEqual({ type: 'h1', text: 'Title' });
    expect(parseMarkdownLine('- [x] done')).toEqual({ type: 'todo', checked: true, text: 'done' });
    expect(parseMarkdownLine('- [ ] todo')).toEqual({ type: 'todo', checked: false, text: 'todo' });
    expect(parseMarkdownLine('* item')).toEqual({ type: 'bullet', text: 'item' });
    expect(parseMarkdownLine('12. item')).toEqual({ type: 'numbered', text: 'item' });
    expect(parseMarkdownLine('> said')).toEqual({ type: 'quote', text: 'said' });
    expect(parseMarkdownLine('---')).toEqual({ type: 'divider', text: '' });
    expect(parseMarkdownLine('plain')).toEqual({ type: 'text', text: 'plain' });
  });

  it('exports a page', () => {
    const { store, a, page, first } = setup();
    a.updateBlock(first, { text: 'Intro' });
    const n1 = a.insertAfter(first, { type: 'numbered', text: 'one' });
    const n2 = a.insertAfter(n1, { type: 'numbered', text: 'two' });
    const t = a.insertAfter(n2, { type: 'todo', text: 'task', checked: true });
    a.insertAfter(t, { type: 'code', text: 'let x = 1;' });
    expect(pageToMarkdown(store.getState(), page)).toBe(
      '# Home\n\nIntro\n\n1. one\n2. two\n\n- [x] task\n\n```\nlet x = 1;\n```\n',
    );
  });
});
