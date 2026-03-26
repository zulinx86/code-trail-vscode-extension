# Changelog

## [0.0.5] - Unreleased

### Fixed

- Reduce VSIX size by including only vis-network standalone JS

## [0.0.4] - 2026-03-26

### Added

- Debug logging via Output panel ("Code Trail" channel) across all commands and utilities
- Auto-refresh graph view when marks are added, changed, or deleted

## [0.0.3] - 2026-03-26

### Changed

- Update README

## [0.0.2] - 2026-03-26

### Added

- `Code Trail: Show Graph` command to visualize marks as a directed graph with vis-network
- `symbolKind` field in mark metadata (function, method, class, struct, enum, interface, const, etc.)
- Duplicate mark detection by file path and symbol name

## [0.0.1] - 2025-03-24

### Added

- `Code Trail: Mark Code` command to mark selected code or symbol at cursor as a Markdown file
- `Code Trail: Link Mark` command to create `uses`/`usedBy` relationships between marks
- Clickable `code-trail:` links to jump between marks and source code
