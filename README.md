# Waltion

**An open-source, local-first workspace for notes and docs.**

Waltion is a block-based editor in the spirit of tools like Notion. Write pages, nest them
inside each other, and build documents out of headings, lists, to-dos, callouts and code. All
of it lives in your browser. There is no account, no server and no tracking.

> Waltion is an independent project. It is not affiliated with, endorsed by, or derived from
> the code of Notion Labs, Inc. It is written from scratch under the MIT license.

## Features

- **Blocks**: text, three heading levels, bulleted, numbered and to-do lists, quotes, callouts,
  code, dividers and embedded sub-pages
- **`/` command menu** to insert or convert blocks from the keyboard
- **Markdown shortcuts**: `#`, `##`, `###`, `-`, `1.`, `[]`, `>`, ` ``` ` and `---`
- **Paste Markdown**: each pasted line becomes the matching block
- **Nested pages** with a collapsible sidebar tree and breadcrumbs
- **Drag and drop** to reorder blocks, plus a block menu to duplicate, delete or "turn into"
- **Full-text search** across every page (`Ctrl/⌘ + K`)
- **Export** a page to Markdown, or export and import the whole workspace as JSON
- **Local-first**: autosaves to `localStorage`, works offline, follows your light or dark theme

## Getting started

```bash
git clone https://github.com/<you>/waltion.git
cd waltion
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm test` | Run the unit tests (Vitest) |
| `npm run build` | Typecheck and build a static site into `dist/` |
| `npm run preview` | Serve the production build locally |

`dist/` is a static site, so you can host it on GitHub Pages, Netlify, Vercel or any file server.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `/` | Open the block menu |
| `Enter` | New block (lists continue; an empty list item becomes text) |
| `Shift + Enter` | Line break inside a block |
| `Backspace` at the start | Turn a block back into text, then merge it with the one above |
| `↑` / `↓` | Move between blocks |
| `Ctrl/⌘ + Enter` | Leave a code block |
| `Ctrl/⌘ + K` | Search |
| `Ctrl/⌘ + \` | Toggle the sidebar |

## How it works

Everything is a **block**: `{ id, type, text, children, parentId }`. A page is a block of
type `page`, and its `children` are the blocks shown on it. A sub-page is just a page block
inside another page, so moving, deleting, duplicating and searching work the same way at
every level.

```
src/
  lib/store.ts      block tree, actions and persistence (no dependencies beyond React)
  lib/markdown.ts   Markdown import (per line) and export
  lib/commands.ts   the / menu catalogue
  lib/caret.ts      caret helpers for contentEditable
  components/       Sidebar, Page, Block, SlashMenu
tests/              Vitest unit tests for the store and Markdown
```

## Roadmap

Contributions are welcome. Good next steps:

- [ ] Inline formatting (bold, italic, links, inline code)
- [ ] Undo and redo across blocks
- [ ] Nested (indented) blocks and toggles
- [ ] Database views: table, board and calendar
- [ ] Images and file attachments
- [ ] Real-time sync and collaboration (for example with CRDTs such as Yjs)
- [ ] Desktop app (Tauri) and mobile layout polish

## Contributing

1. Fork the repo and create a branch.
2. `npm install`, make your change, and add or update tests.
3. Make sure `npm test` and `npm run build` pass.
4. Open a pull request describing what changed and why.

## License

[MIT](LICENSE)
