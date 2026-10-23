import type { BlockType } from './store';

export interface Command {
  type: BlockType;
  label: string;
  hint: string;
  icon: string;
  keywords: string;
}

export const COMMANDS: Command[] = [
  { type: 'text', label: 'Text', hint: 'Plain writing', icon: 'Aa', keywords: 'paragraph plain' },
  { type: 'page', label: 'Page', hint: 'Embed a sub-page', icon: '📄', keywords: 'subpage new' },
  { type: 'h1', label: 'Heading 1', hint: 'Big section heading', icon: 'H1', keywords: 'title h1' },
  { type: 'h2', label: 'Heading 2', hint: 'Medium section heading', icon: 'H2', keywords: 'subtitle h2' },
  { type: 'h3', label: 'Heading 3', hint: 'Small section heading', icon: 'H3', keywords: 'h3' },
  { type: 'bullet', label: 'Bulleted list', hint: 'A simple list', icon: '•', keywords: 'ul unordered' },
  { type: 'numbered', label: 'Numbered list', hint: 'A list with numbers', icon: '1.', keywords: 'ol ordered' },
  { type: 'todo', label: 'To-do list', hint: 'Track tasks', icon: '☑', keywords: 'todo task checkbox check' },
  { type: 'quote', label: 'Quote', hint: 'Capture a quote', icon: '❝', keywords: 'blockquote' },
  { type: 'callout', label: 'Callout', hint: 'Make writing stand out', icon: '💡', keywords: 'note info tip' },
  { type: 'code', label: 'Code', hint: 'Code snippet', icon: '</>', keywords: 'snippet pre' },
  { type: 'divider', label: 'Divider', hint: 'Separate sections', icon: '—', keywords: 'hr line separator' },
];

export function filterCommands(query: string, exclude: BlockType[] = []): Command[] {
  const q = query.toLowerCase();
  return COMMANDS.filter(
    (c) => !exclude.includes(c.type) && (c.label.toLowerCase().includes(q) || c.keywords.includes(q)),
  );
}
