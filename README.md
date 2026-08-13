# jqw

jqw is a compact jq workbench that transforms JSON entirely in your browser.
Paste one JSON value, write a jq query, and copy the formatted result. No server
receives the input.

## Features

- Browser-native jq powered by WebAssembly in a dedicated Worker
- CodeMirror JSON editor with syntax highlighting, line numbers, and diagnostics
- Automatic execution after editing, plus Command/Control + Enter
- Resizable two-column desktop workspace and stacked mobile layout
- Clear JSON and jq errors without leaving stale output on screen
- JSON formatting and one-click result copying
- Light and dark themes
- Long-query Stop action after 5 seconds and automatic termination after 30
  seconds
- 5 MiB formatted-output limit

## Privacy

JSON, queries, results, history, and panel sizes are never persisted. They stay
in browser memory and reset to the bundled sample on reload. The selected light
or dark theme is the sole local-storage value.

The production app has no analytics, telemetry, CDN assets, external fonts, or
runtime API calls. It only loads its static JavaScript, CSS, Worker, and
WebAssembly files from the hosting origin. See
[the architecture contract](docs/architecture.md) for the full boundary.

## Development

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Available checks:

```sh
npm run check      # lint, unit tests, type checking, and production build
npm run test:e2e   # browser integration tests against the built artifact
```

`npm run build` creates the static application in `dist/`. It can be served by
any static host, including from a subpath. Deployment automation and PWA support
are intentionally outside this first release.

## Browser support

jqw targets current Chrome, Edge, Firefox, and Safari releases. Older browsers
without modern WebAssembly and Worker support are not supported.

## License

[MIT](LICENSE)
