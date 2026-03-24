# Code Trail

A VS Code extension for recording code reading notes.

## Features

- Mark code in the editor as a Markdown file with YAML frontmatter
- Automatically detects the symbol (function, class, method) at cursor position
- Records file path, line range, symbol name, timestamp, GitHub URL, and the selected code
- Link marks to each other with `uses`/`usedBy` relationships, with call hierarchy suggestions
- Clickable `code-trail:` links to jump between marks and source code
- Outputs to the `code-trail/` directory in your workspace

## Commands

| Command                 | Keybinding     | Description                                |
| ----------------------- | -------------- | ------------------------------------------ |
| `Code Trail: Mark Code` | `Ctrl+Shift+M` | Mark the selected code or symbol at cursor |
| `Code Trail: Link Mark` | `Ctrl+Shift+L` | Link the current mark to another mark      |

## Usage

1. Select code in the editor (or place cursor inside a function/method)
2. Run `Code Trail: Mark Code`
3. Open a mark file and run `Code Trail: Link Mark` to create relationships between marks
