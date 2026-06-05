# Markdown Plugin for Schrödinger

Convert between Markdown and HTML on the clipboard.

## Modes

- **To HTML** — converts Markdown text to HTML
- **To Markdown** — converts HTML content back to Markdown

## Installation

Install from the Schrödinger Plugin Manager (Preferences → Plugins → Browse), or manually:

1. Download the latest release `.tar.gz` from [Releases](https://github.com/georgemandis/schrodinger-plugin-markdown/releases)
2. In Schrödinger Preferences → Plugins, click Install and provide the archive path

## Development

This is a script plugin (JavaScript). The plugin consists of:

- `plugin.json` — manifest describing the plugin
- `index.js` — plugin implementation

To develop locally, symlink this directory into your Schrödinger plugins folder:

```sh
ln -s "$(pwd)" ~/.schrodinger/plugins/markdown
```

## License

MIT
