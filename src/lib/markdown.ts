import type { Block, BlockInit, BlockType, State } from './store';

const LIST_TYPES: ReadonlySet<BlockType> = new Set(['bullet', 'numbered', 'todo']);

// Shortcuts recognised both while typing and when pasting Markdown lines.
// Order matters: longer prefixes first.
export const LINE_PREFIXES: [RegExp, BlockInit][] = [
  [/^### /, { type: 'h3' }],
  [/^## /, { type: 'h2' }],
  [/^# /, { type: 'h1' }],
  [/^[-*+] \[[xX]\] /, { type: 'todo', checked: true }],
  [/^(?:[-*+] )?\[ ?\] /, { type: 'todo', checked: false }],
  [/^[-*+] /, { type: 'bullet' }],
  [/^\d+[.)] /, { type: 'numbered' }],
  [/^> /, { type: 'quote' }],
  [/^``` ?/, { type: 'code' }],
];

/** Turn one line of Markdown into a block description. */
export function parseMarkdownLine(line: string): BlockInit {
  if (/^(-{3,}|\*{3,})$/.test(line.trim())) return { type: 'divider', text: '' };
  for (const [re, init] of LINE_PREFIXES) {
    const m = line.match(re);
    if (m) return { ...init, text: line.slice(m[0].length) };
  }
  return { type: 'text', text: line };
}

function blockToMarkdown(b: Block, number: number): string {
  const prefixLines = (prefix: string) =>
    b.text
      .split('\n')
      .map((l) => prefix + l)
      .join('\n');
  switch (b.type) {
    case 'h1':
      return `# ${b.text}`;
    case 'h2':
      return `## ${b.text}`;
    case 'h3':
      return `### ${b.text}`;
    case 'bullet':
      return `- ${b.text}`;
    case 'numbered':
      return `${number}. ${b.text}`;
    case 'todo':
      return `- [${b.checked ? 'x' : ' '}] ${b.text}`;
    case 'quote':
      return prefixLines('> ');
    case 'callout':
      return `> ${b.icon ?? '💡'} ${b.text.split('\n').join('\n> ')}`;
    case 'code':
      return '```\n' + b.text + '\n```';
    case 'divider':
      return '---';
    case 'page':
      return `${b.icon ?? '📄'} **${b.text || 'Untitled'}**`;
    default:
      return b.text;
  }
}

/** Export a page (title + its blocks) as Markdown. Sub-pages appear as links by name. */
export function pageToMarkdown(s: State, pageId: string): string {
  const page = s.blocks[pageId];
  if (!page) return '';
  const title = `# ${page.icon ? page.icon + ' ' : ''}${page.text || 'Untitled'}`;
  let out = title;
  let number = 0;
  let prev: BlockType | null = null;
  for (const id of page.children) {
    const b = s.blocks[id];
    if (!b) continue;
    number = b.type === 'numbered' ? number + 1 : 0;
    const tight = prev !== null && prev === b.type && LIST_TYPES.has(b.type);
    out += (tight ? '\n' : '\n\n') + blockToMarkdown(b, number);
    prev = b.type;
  }
  return out + '\n';
}
