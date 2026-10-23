import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { actions, pageAncestors, store, useWaltion } from '../lib/store';
import { focusBlock } from '../lib/caret';
import { pageToMarkdown } from '../lib/markdown';
import { BlockRow } from './Block';

const EMOJI = '📄 📝 📚 📌 ✅ 💡 🚀 🎯 📅 🗂️ 🧠 ⭐ 🔥 🌱 🎨 🛠️ 💼 📈 🏠 ✈️ 🍳 🎵 📷 🧪 💬 🔒 🌍 ❤️ 👋 🐙'.split(' ');

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(name: string) {
  return (name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Untitled';
}

export function Topbar({ pageId, onToggleSidebar }: { pageId: string | null; onToggleSidebar: () => void }) {
  const crumbs = useWaltion((s) =>
    pageId
      ? pageAncestors(s, pageId)
          .map((id) => `${id}\u0000${s.blocks[id]?.icon ?? ''}\u0000${s.blocks[id]?.text ?? ''}`)
          .join('\u0001')
      : '',
  );
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={onToggleSidebar} title="Toggle sidebar (Ctrl/⌘ + \)" aria-label="Toggle sidebar">
        ☰
      </button>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        {crumbs &&
          crumbs.split('\u0001').map((c, i) => {
            const [id, icon, title] = c.split('\u0000');
            return (
              <span key={id} className="crumb">
                {i > 0 && <span className="crumb-sep">/</span>}
                <button onClick={() => actions.setActivePage(id)}>
                  {icon && <span>{icon} </span>}
                  {title || 'Untitled'}
                </button>
              </span>
            );
          })}
      </nav>
      {pageId && (
        <button
          className="text-btn"
          onClick={() => {
            const s = store.getState();
            download(`${safeFilename(s.blocks[pageId].text)}.md`, pageToMarkdown(s, pageId), 'text/markdown');
          }}
        >
          Export .md
        </button>
      )}
    </header>
  );
}

export function PageView({ pageId }: { pageId: string }) {
  const page = useWaltion((s) => s.blocks[pageId]);
  // A string keeps the selector's result stable between unrelated updates.
  const childTypes = useWaltion((s) => s.blocks[pageId]?.children.map((id) => s.blocks[id]?.type).join(',') ?? '');
  const titleRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (el && page && el.textContent !== page.text) el.textContent = page.text;
  }, [page?.text, pageId]);

  useEffect(() => {
    setPickerOpen(false);
    if (page && !page.text) focusBlock(`title:${pageId}`);
  }, [pageId]);

  if (!page) return null;

  const types = childTypes ? childTypes.split(',') : [];
  let n = 0;
  const numbers = types.map((t) => (n = t === 'numbered' ? n + 1 : 0));

  const focusFirstBlock = () => {
    const first = page.children[0];
    if (first) focusBlock(first, 0);
    else focusBlock(actions.appendBlock(pageId));
  };

  return (
    <article className="page">
      <div className="page-header">
        {page.icon ? (
          <button className="page-icon" onClick={() => setPickerOpen((o) => !o)} aria-label="Change icon">
            {page.icon}
          </button>
        ) : (
          <button className="text-btn add-icon" onClick={() => setPickerOpen(true)}>
            ☺ Add icon
          </button>
        )}
        {pickerOpen && (
          <div className="popover emoji-picker">
            <div className="emoji-grid">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    actions.updateBlock(pageId, { icon: e });
                    setPickerOpen(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
            {page.icon && (
              <button
                className="popover-item"
                onClick={() => {
                  actions.updateBlock(pageId, { icon: undefined });
                  setPickerOpen(false);
                }}
              >
                Remove icon
              </button>
            )}
          </div>
        )}
        <div
          ref={titleRef}
          className="page-title editable"
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          data-editable={`title:${pageId}`}
          data-placeholder="Untitled"
          role="heading"
          aria-level={1}
          onInput={(e) => {
            const el = e.currentTarget;
            if (el.textContent === '' && el.innerHTML !== '') el.innerHTML = '';
            actions.updateBlock(pageId, { text: el.textContent ?? '' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
              e.preventDefault();
              focusFirstBlock();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '));
          }}
        />
      </div>
      <div className="blocks">
        {page.children.map((id, i) => (
          <BlockRow key={id} id={id} number={numbers[i]} />
        ))}
      </div>
      <div
        className="page-tail"
        onClick={() => {
          const s = store.getState();
          const lastId = page.children[page.children.length - 1];
          const last = lastId ? s.blocks[lastId] : null;
          if (last && last.type === 'text' && last.text === '') focusBlock(lastId);
          else focusBlock(actions.appendBlock(pageId));
        }}
      />
    </article>
  );
}
