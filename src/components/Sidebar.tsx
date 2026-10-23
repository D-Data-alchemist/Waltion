import { forwardRef, useRef, useState } from 'react';
import { actions, isValidState, owningPage, store, useWaltion } from '../lib/store';

function PageTreeItem({ id, depth }: { id: string; depth: number }) {
  const page = useWaltion((s) => s.blocks[id]);
  const childPages = useWaltion(
    (s) => s.blocks[id]?.children.filter((c) => s.blocks[c]?.type === 'page').join(',') ?? '',
  );
  const active = useWaltion((s) => s.activePageId === id);
  const [open, setOpen] = useState(depth === 0);
  if (!page) return null;
  const children = childPages ? childPages.split(',') : [];

  return (
    <li>
      <div className={`tree-row${active ? ' active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }}>
        <button
          className="tree-toggle"
          aria-label={open ? 'Collapse' : 'Expand'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{ visibility: children.length ? 'visible' : 'hidden' }}
        >
          {open ? '▾' : '▸'}
        </button>
        <button className="tree-title" onClick={() => actions.setActivePage(id)}>
          <span className="tree-icon">{page.icon ?? '📄'}</span>
          <span className="tree-label">{page.text || 'Untitled'}</span>
        </button>
        <span className="tree-actions">
          <button
            title="Add a page inside"
            aria-label="Add a page inside"
            onClick={() => {
              setOpen(true);
              actions.setActivePage(actions.createPage(id));
            }}
          >
            +
          </button>
          <button
            title="Delete page"
            aria-label="Delete page"
            onClick={() => {
              if (confirm(`Delete “${page.text || 'Untitled'}” and everything in it?`)) actions.deleteBlock(id);
            }}
          >
            🗑
          </button>
        </span>
      </div>
      {open && children.length > 0 && (
        <ul>
          {children.map((c) => (
            <PageTreeItem key={c} id={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export const Sidebar = forwardRef<HTMLInputElement, { open: boolean; onNavigate: () => void }>(function Sidebar(
  { open, onNavigate },
  searchRef,
) {
  const rootPages = useWaltion((s) => s.rootPages);
  const [query, setQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const results = useWaltion((s) => {
    if (!q) return '';
    const ids = new Set<string>();
    for (const b of Object.values(s.blocks)) {
      if (b.text.toLowerCase().includes(q)) {
        const p = owningPage(s, b.id);
        if (p) ids.add(p);
      }
    }
    return [...ids].join(',');
  });

  const go = (id: string) => {
    actions.setActivePage(id);
    onNavigate();
  };

  return (
    <aside className={`sidebar${open ? '' : ' closed'}`} aria-label="Pages">
      <div className="workspace">
        <span className="workspace-logo">W</span>
        <span>Waltion</span>
      </div>
      <input
        ref={searchRef}
        className="search"
        type="search"
        placeholder="Search  (Ctrl/⌘ K)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('');
          if (e.key === 'Enter' && results) go(results.split(',')[0]);
        }}
      />
      <nav className="tree">
        {q ? (
          <SearchResults ids={results ? results.split(',') : []} onPick={go} />
        ) : (
          <ul onClick={(e) => (e.target as HTMLElement).closest('.tree-title') && onNavigate()}>
            {rootPages.map((id) => (
              <PageTreeItem key={id} id={id} depth={0} />
            ))}
          </ul>
        )}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-btn" onClick={() => go(actions.createPage(null))}>
          + New page
        </button>
        <button
          className="sidebar-btn"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(store.getState(), null, 2)], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `waltion-workspace-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          ⤓ Export workspace
        </button>
        <button className="sidebar-btn" onClick={() => fileRef.current?.click()}>
          ⤒ Import workspace
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const parsed = JSON.parse(await file.text());
              if (!isValidState(parsed)) throw new Error('not a Waltion workspace');
              if (confirm('Replace your current workspace with this file? This cannot be undone.')) {
                actions.replaceState(parsed);
              }
            } catch (err) {
              alert(`Could not import: ${(err as Error).message}`);
            }
          }}
        />
      </div>
    </aside>
  );
});

function SearchResults({ ids, onPick }: { ids: string[]; onPick: (id: string) => void }) {
  const pages = useWaltion((s) => ids.map((id) => `${s.blocks[id]?.icon ?? '📄'} ${s.blocks[id]?.text || 'Untitled'}`).join('\u0000'));
  if (!ids.length) return <p className="tree-empty">No matching pages</p>;
  const labels = pages.split('\u0000');
  return (
    <ul>
      {ids.map((id, i) => (
        <li key={id}>
          <div className="tree-row" style={{ paddingLeft: 8 }}>
            <button className="tree-title" onClick={() => onPick(id)}>
              <span className="tree-label">{labels[i]}</span>
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
