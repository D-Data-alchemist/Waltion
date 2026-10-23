import { useEffect, useRef, useState } from 'react';
import { actions, useWaltion } from './lib/store';
import { Sidebar } from './components/Sidebar';
import { PageView, Topbar } from './components/Page';

const NARROW = '(max-width: 760px)';

function pageFromHash(): string | null {
  const m = location.hash.match(/^#\/([\w-]+)$/);
  return m ? m[1] : null;
}

export function App() {
  const activePageId = useWaltion((s) => s.activePageId);
  const activeExists = useWaltion((s) => !!(s.activePageId && s.blocks[s.activePageId]));
  const hasPages = useWaltion((s) => s.rootPages.length > 0);
  const [sidebarOpen, setSidebarOpen] = useState(() => !matchMedia(NARROW).matches);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keep the URL hash and the active page in sync so links and Back work.
  useEffect(() => {
    const fromHash = pageFromHash();
    if (fromHash) actions.setActivePage(fromHash);
    const onHash = () => {
      const id = pageFromHash();
      if (id) actions.setActivePage(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!activeExists && hasPages) actions.setActivePage(null);
    if (activePageId && pageFromHash() !== activePageId) location.hash = `/${activePageId}`;
  }, [activePageId, activeExists, hasPages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSidebarOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      } else if (mod && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closeIfNarrow = () => matchMedia(NARROW).matches && setSidebarOpen(false);

  return (
    <div className={`app${sidebarOpen ? ' sidebar-open' : ''}`}>
      <Sidebar ref={searchRef} open={sidebarOpen} onNavigate={closeIfNarrow} />
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
      <main className="main">
        <Topbar pageId={activeExists ? activePageId : null} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        {activeExists && activePageId ? (
          <PageView pageId={activePageId} />
        ) : (
          <div className="empty">
            <p>No pages yet.</p>
            <button className="primary-btn" onClick={() => actions.setActivePage(actions.createPage(null))}>
              Create a page
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
