# Changelog

## [0.0.7]

### Changed

- Use monospace font for graph view nodes

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
