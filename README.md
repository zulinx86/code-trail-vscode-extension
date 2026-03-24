# Code Atlas

A VS Code extension for recording code reading notes.

## Features

- Pin code in the editor as a Markdown file with YAML frontmatter
- Automatically detects the symbol (function, class, method) at cursor position
- Records file path, line range, symbol name, timestamp, GitHub URL, and the selected code
- Link pins to each other with `uses`/`usedBy` relationships, with call hierarchy suggestions
- Clickable `code-atlas:` links to jump between pins and source code
- Outputs to the `code-atlas/` directory in your workspace

## Commands

| Command                | Keybinding     | Description                               |
| ---------------------- | -------------- | ----------------------------------------- |
| `Code Atlas: Pin Code` | `Ctrl+Shift+P` | Pin the selected code or symbol at cursor |
| `Code Atlas: Link Pin` | `Ctrl+Shift+L` | Link the current pin to another pin       |

## Usage

1. Select code in the editor (or place cursor inside a function/method)
2. Run `Code Atlas: Pin Code`
3. Open a pin file and run `Code Atlas: Link Pin` to create relationships between pins
