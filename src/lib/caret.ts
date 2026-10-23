/** Caret offset (in characters) from the start of an editable element. */
export function getCaret(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return 0;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

export function selectionCollapsed(): boolean {
  const sel = window.getSelection();
  return !sel || sel.isCollapsed;
}

export function setCaret(el: HTMLElement, offset: number) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
  }
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Focus a block (or a page title, via `title:<pageId>`) after React has rendered.
 * React commits store updates from key handlers in a microtask, so try there
 * first (before the next keystroke can land in the old block), then on the
 * next frame for anything rendered later.
 */
export function focusBlock(id: string, offset: number | 'end' = 0) {
  const attempt = () => {
    const el = document.querySelector<HTMLElement>(`[data-editable="${CSS.escape(id)}"]`);
    if (!el) return false;
    if (el.isContentEditable) setCaret(el, offset === 'end' ? el.textContent?.length ?? 0 : offset);
    else el.focus();
    return true;
  };
  queueMicrotask(() => {
    if (!attempt()) requestAnimationFrame(attempt);
  });
}
