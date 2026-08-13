import {
  AlertTriangle,
  AlignLeft,
  Braces,
  Check,
  Clipboard,
  LoaderCircle,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditor } from "@/components/code-editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useJqRunner } from "@/hooks/use-jq-runner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { formatJson as formatJsonSource } from "@/lib/format-json";
import type { QueryRunnerState } from "@/lib/query-runner";
import { cn } from "@/lib/utils";

const SAMPLE_JSON = `{
  "products": [
    {
      "name": "Field Notes",
      "price": 12,
      "inStock": true
    },
    {
      "name": "Mechanical Pencil",
      "price": 8,
      "inStock": false
    },
    {
      "name": "Desk Tray",
      "price": 24,
      "inStock": true
    }
  ]
}`;

const SAMPLE_QUERY = ".products[] | select(.inStock) | {name, price}";

interface PaneProps {
  className?: string;
  theme: Theme;
}

interface JsonPaneProps extends PaneProps {
  value: string;
  onChange: (value: string) => void;
  onFormat: () => void;
  onRun: () => void;
}

function JsonPane({
  className,
  theme,
  value,
  onChange,
  onFormat,
  onRun,
}: JsonPaneProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        className,
      )}
      aria-labelledby="json-input-heading"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2.5">
          <span className="size-1.5 rounded-full bg-ring" aria-hidden="true" />
          <h2
            id="json-input-heading"
            className="text-sm font-medium tracking-tight"
          >
            JSON Input
          </h2>
        </div>
        <Button
          type="button"
          variant="toolbar"
          size="sm"
          onClick={onFormat}
          aria-label="Format JSON"
        >
          <AlignLeft aria-hidden="true" />
          Format
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={value}
          onChange={onChange}
          onRun={onRun}
          theme={theme}
          label="JSON input editor"
          validateJson
          testId="json-editor"
        />
      </div>
    </section>
  );
}

interface ResultBodyProps {
  state: QueryRunnerState;
  theme: Theme;
  onStop: () => void;
}

function ResultBody({ state, theme, onStop }: ResultBodyProps) {
  if (state.phase === "success" && state.output.length > 0) {
    return (
      <CodeEditor
        value={state.output}
        theme={theme}
        label="jq output"
        readOnly
        testId="output-editor"
      />
    );
  }

  if (state.phase === "error" || state.phase === "stopped") {
    return (
      <div
        className="grid h-full place-items-center overflow-auto p-6"
        role="alert"
        data-testid="query-error"
      >
        <div className="w-full max-w-lg rounded-lg border border-destructive/25 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-medium">
                {state.error?.title ?? "Something went wrong"}
              </h3>
              {state.error?.line && state.error.column ? (
                <p className="mt-1 text-xs font-medium text-destructive">
                  Line {state.error.line}, column {state.error.column}
                </p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-muted-foreground">
                {state.error?.message}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "success") {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <Braces
            aria-hidden="true"
            className="mx-auto size-5 text-muted-foreground/70"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Query produced no output.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid h-full place-items-center p-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div>
        <LoaderCircle
          aria-hidden="true"
          className="mx-auto size-5 animate-spin text-muted-foreground"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {state.phase === "running" ? "Running jq…" : "Waiting to run…"}
        </p>
        {state.phase === "running" && state.canStop ? (
          <div className="mt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              This query is taking longer than expected.
            </p>
            <Button
              type="button"
              variant="toolbar"
              size="sm"
              onClick={onStop}
              className="border-destructive/20 bg-destructive/5 text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <Square aria-hidden="true" className="size-2.5 fill-current" />
              Stop
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface QueryPaneProps extends PaneProps {
  query: string;
  onQueryChange: (query: string) => void;
  onRun: () => void;
  onStop: () => void;
  state: QueryRunnerState;
}

function QueryPane({
  className,
  theme,
  query,
  onQueryChange,
  onRun,
  onStop,
  state,
}: QueryPaneProps) {
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canCopy = state.phase === "success" && state.output.length > 0;
  const copyButtonLabel =
    copyStatus === "copied"
      ? "Copied output"
      : copyStatus === "failed"
        ? "Retry copying output"
        : "Copy output";

  useEffect(
    () => () => {
      if (copyResetTimer.current) {
        clearTimeout(copyResetTimer.current);
      }
    },
    [],
  );

  const copyOutput = useCallback(async () => {
    if (!canCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.output);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }

    if (copyResetTimer.current) {
      clearTimeout(copyResetTimer.current);
    }
    copyResetTimer.current = setTimeout(() => setCopyStatus("idle"), 2_000);
  }, [canCopy, state.output]);

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        className,
      )}
      aria-labelledby="jq-query-heading"
    >
      <div className="shrink-0 border-b p-3">
        <div className="mb-2 flex items-center justify-between gap-4 px-1">
          <label
            id="jq-query-heading"
            htmlFor="jq-query"
            className="text-sm font-medium tracking-tight"
          >
            jq Query
          </label>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            ⌘ / Ctrl + Enter to run
          </span>
        </div>
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-muted-foreground"
            aria-hidden="true"
          >
            $
          </span>
          <Input
            id="jq-query"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onRun();
              }
            }}
            className={cn(
              "pl-8 font-mono",
              state.error?.kind === "query" &&
                "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
            )}
            aria-invalid={state.error?.kind === "query" || undefined}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              state.phase === "error" || state.phase === "stopped"
                ? "bg-destructive"
                : state.phase === "running" || state.phase === "pending"
                  ? "animate-pulse bg-muted-foreground"
                  : "bg-ring",
            )}
            aria-hidden="true"
          />
          <h2 className="text-sm font-medium tracking-tight">Output</h2>
          {state.warning ? (
            <span
              className="truncate text-[11px] text-amber-600 dark:text-amber-400"
              title={state.warning}
            >
              Completed with warnings
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="toolbar"
          size="sm"
          onClick={copyOutput}
          disabled={!canCopy}
          aria-label={copyButtonLabel}
          className={cn(
            "w-[6.25rem]",
            copyStatus === "copied" &&
              "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300",
          )}
        >
          {copyStatus === "copied" ? (
            <Check aria-hidden="true" />
          ) : (
            <Clipboard aria-hidden="true" />
          )}
          {copyStatus === "copied"
            ? "Copied"
            : copyStatus === "failed"
              ? "Retry"
              : "Copy"}
        </Button>
        <span className="sr-only" aria-live="polite">
          {copyStatus === "copied"
            ? "Output copied to clipboard."
            : copyStatus === "failed"
              ? "Output could not be copied."
              : ""}
        </span>
      </div>

      <div className="min-h-0 flex-1" data-testid="output-region">
        <ResultBody state={state} theme={theme} onStop={onStop} />
      </div>
    </section>
  );
}

export function App() {
  const [input, setInput] = useState(SAMPLE_JSON);
  const [query, setQuery] = useState(SAMPLE_QUERY);
  const { theme, toggleTheme } = useTheme();
  const isNarrow = useMediaQuery("(max-width: 767px)");
  const { state, runNow, stop } = useJqRunner(input, query);

  const handleFormatJson = useCallback(() => {
    try {
      setInput(formatJsonSource(input));
    } catch {
      runNow();
    }
  }, [input, runNow]);

  const jsonPane = (
    <JsonPane
      theme={theme}
      value={input}
      onChange={setInput}
      onFormat={handleFormatJson}
      onRun={runNow}
      className={isNarrow ? "h-[56svh] min-h-[26rem]" : "h-full"}
    />
  );
  const queryPane = (
    <QueryPane
      theme={theme}
      query={query}
      onQueryChange={setQuery}
      onRun={runNow}
      onStop={stop}
      state={state}
      className={isNarrow ? "h-[68svh] min-h-[32rem]" : "h-full"}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:h-dvh md:min-h-[36rem] md:overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground text-background shadow-sm">
            <Braces aria-hidden="true" className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-none tracking-tight">
              jqw
            </h1>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Transform JSON locally in your browser.
            </p>
          </div>
        </div>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      {isNarrow ? (
        <main className="flex-1 space-y-3 p-3">{jsonPane}{queryPane}</main>
      ) : (
        <main className="min-h-0 flex-1 p-3">
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full"
            aria-label="JSON input and jq output panels"
          >
            <ResizablePanel defaultSize={50} minSize={28}>
              {jsonPane}
            </ResizablePanel>
            <ResizableHandle
              withHandle
              aria-label="Resize JSON input and output panels"
            />
            <ResizablePanel defaultSize={50} minSize={28}>
              {queryPane}
            </ResizablePanel>
          </ResizablePanelGroup>
        </main>
      )}
    </div>
  );
}
