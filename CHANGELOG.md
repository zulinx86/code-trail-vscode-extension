# Changelog

## [0.1.3]

### Added

- `Code Trail: Add Title` command (`Ctrl+Shift+T`) to create title nodes in the graph
- `codeTrail.graphTitleFontSize` setting to configure title node font size in graph view (default: 32)
- `codeTrail.graphCodeFontSize` setting to configure code snippet font size in graph view (default: 18)
- `codeTrail.graphHeaderFontSize` setting to configure node header label font size in graph view (default: 20)
- `codeTrail.graphLabelFontSize` setting to configure file path label font size in graph view (default: 14)

## [0.1.2]

### Added

- `codeTrail.tabSize` setting to configure tab expansion width in graph view (default: 4)
- `codeTrail.tabSizeByLanguage` setting for per-language tab size overrides (e.g. `{"go": 8}`)
- `codeTrail.symbolColors` setting to override node colors by symbol kind in graph view

## [0.1.1]

### Fixed

- Prevent nodes from disappearing when partially outside the viewport in graph view
- Expand tabs to 4 spaces in code snippets in graph view

## [0.1.0]

### Added

- Demo GIF in README

### Changed

- Use Ctrl/Cmd+Click instead of double-click to open mark files in graph view

### Fixed

- Wrap external label text to fit within node width in graph view

## [0.0.7]

### Changed

- Scroll to pan and Ctrl/Cmd+scroll to zoom in graph view
- Show code snippets inside graph nodes (expanded by default, click to toggle)
- Show file path and line range above each node
- Double-click a node to open the mark file
- Scroll to pan, Ctrl/Cmd+scroll to zoom in graph view

## [0.0.6]

### Added

- Allow dragging nodes in all directions in graph view

### Fixed

- Use Dagre for graph layout to prevent node overlapping with long labels
- Fix link suggestions for Rust by matching on name only

## [0.0.5]

### Added

- Prompt link suggestions based on call hierarchy after marking code

### Fixed

- Reduce VSIX size by including only vis-network standalone JS
- Replace spaces in symbol names with hyphens in mark filenames
- Increase graph node spacing to prevent overlapping

## [0.0.4]

### Added

- Debug logging via Output panel ("Code Trail" channel) across all commands and utilities
- Auto-refresh graph view when marks are added, changed, or deleted

## [0.0.3]

### Changed

- Update README

## [0.0.2]

### Added

- `Code Trail: Show Graph` command to visualize marks as a directed graph with vis-network
- `symbolKind` field in mark metadata (function, method, class, struct, enum, interface, const, etc.)
- Duplicate mark detection by file path and symbol name

## [0.0.1]

### Added

- `Code Trail: Mark Code` command to mark selected code or symbol at cursor as a Markdown file
- `Code Trail: Link Mark` command to create `uses`/`usedBy` relationships between marks
- Clickable `code-trail:` links to jump between marks and source code
