import { useEffect, useRef } from 'react';
import type { BlockType } from '../lib/store';
import type { Command } from '../lib/commands';

interface Props {
  items: Command[];
  index: number;
  onHover: (index: number) => void;
  onPick: (type: BlockType) => void;
}

export function SlashMenu({ items, index, onHover, onPick }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return (
    <div className="popover slash-menu" ref={listRef} role="listbox" aria-label="Insert block">
      <div className="popover-label">Basic blocks</div>
      {items.length === 0 && <div className="popover-empty">No results</div>}
      {items.map((c, i) => (
        <button
          key={c.type}
          role="option"
          aria-selected={i === index}
          className={`popover-item${i === index ? ' active' : ''}`}
          // mousedown keeps focus (and the caret) inside the block being edited
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(c.type);
          }}
          onMouseEnter={() => onHover(i)}
        >
          <span className="cmd-icon">{c.icon}</span>
          <span className="cmd-text">
            <span>{c.label}</span>
            <small>{c.hint}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
