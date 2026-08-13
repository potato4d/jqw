# Architecture

This document records the boundaries that keep jqw static, local, and safe to
use with pasted JSON.

## Runtime boundary

jqw is a single-route React application built by Vite. The production `dist/`
directory is a self-contained static artifact. It has no backend, service
worker, PWA cache, authentication, analytics, telemetry, or third-party runtime
integration.

The browser fetches JavaScript, CSS, the jq worker, and the jq WebAssembly binary
from the same static origin. A restrictive Content Security Policy disallows
cross-origin connections. The app does not load external fonts, icons, or CDN
assets.

## Data ownership

JSON input, jq queries, results, errors, panel sizes, and clipboard feedback
exist only in React or editor memory. Reloading restores the bundled sample.
They are never written to browser storage or sent to a server.

The only persisted value is the explicit `light` or `dark` theme choice under
the `jqw-theme` local-storage key. When that key does not exist, startup follows
the operating-system color preference. Panel sizes deliberately reset to an
even split.

## Query lifecycle

1. Editing either input clears the old result and schedules execution after a
   250 ms quiet period. Command/Control + Enter runs immediately.
2. A dedicated Web Worker loads jq through WebAssembly and first validates that
   the input is exactly one JSON value.
3. Editing while jq is running terminates that Worker. Synchronous WebAssembly
   cannot consume a cooperative cancellation message, so termination is the
   cancellation boundary.
4. After five seconds the UI exposes a Stop action. After thirty seconds the
   app terminates the Worker automatically.
5. Successful jq stdout is rendered as formatted JSON text. Empty stdout has a
   dedicated empty state. Exit errors replace, rather than coexist with, the
   previous result.
6. Output larger than 5 MiB in UTF-8 is rejected before it crosses back into
   the main UI. This limit protects transfer and rendering; Worker termination
   remains the execution and memory safety valve while jq is producing output.

An internal Worker failure discards the Worker so the next edit creates a fresh
engine. Valid jq warnings on stderr remain non-blocking and are surfaced in the
output header.

## Verification boundaries

- Vitest covers strict input validation, jq exit behavior, UTF-8 output limits,
  debounce, stale messages, cancellation, Stop, and forced timeout.
- Playwright covers the built static artifact, core editing flow, errors,
  formatting, clipboard behavior, theme-only persistence, keyboard resizing,
  same-origin resources, and the narrow-screen layout. Desktop coverage runs
  on Chromium, Firefox, and WebKit; the responsive case also runs with a mobile
  Chromium viewport.
- `npm run check` is the repository gate for lint, unit tests, type checking,
  and the production build. `npm run test:e2e` is the browser integration gate.

Build products, browser reports, screenshots, local environment files, and
runtime data are ignored and must not be committed.
