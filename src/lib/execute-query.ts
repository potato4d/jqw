import type { QueryErrorInfo } from "./jq-worker-protocol";

interface RawJqResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface JqHandle {
  raw(input: string, query: string): RawJqResult;
}

export type ExecuteQueryResult =
  | { ok: true; output: string; warning?: string }
  | { ok: false; error: QueryErrorInfo };

function offsetToPosition(source: string, offset: number) {
  const beforeOffset = source.slice(0, offset);
  const lines = beforeOffset.split("\n");

  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

export function describeJsonError(
  source: string,
  error: unknown,
): QueryErrorInfo {
  const message = error instanceof Error ? error.message : "Unable to parse JSON.";
  const positionMatch = message.match(/position\s+(\d+)/i);
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  const position = positionMatch
    ? offsetToPosition(source, Number(positionMatch[1]))
    : lineColumnMatch
      ? {
          line: Number(lineColumnMatch[1]),
          column: Number(lineColumnMatch[2]),
        }
      : undefined;

  return {
    kind: "input",
    title: "Invalid JSON",
    message,
    ...position,
  };
}

export function executeQuery(
  jq: JqHandle,
  input: string,
  query: string,
  outputLimitBytes: number,
): ExecuteQueryResult {
  if (query.trim().length === 0) {
    return {
      ok: false,
      error: {
        kind: "query",
        title: "Query required",
        message: "Enter a jq query to transform the input.",
      },
    };
  }

  try {
    JSON.parse(input);
  } catch (error) {
    return { ok: false, error: describeJsonError(input, error) };
  }

  const result = jq.raw(input, query);

  if (result.exitCode !== 0) {
    return {
      ok: false,
      error: {
        kind: "query",
        title: "jq error",
        message: result.stderr.trim() || `jq exited with code ${result.exitCode}.`,
      },
    };
  }

  const outputIsTooLarge =
    result.stdout.length > outputLimitBytes ||
    new TextEncoder().encode(result.stdout).byteLength > outputLimitBytes;

  if (outputIsTooLarge) {
    return {
      ok: false,
      error: {
        kind: "output",
        title: "Output too large",
        message: "Output exceeded the 5 MB limit.",
      },
    };
  }

  const warning = result.stderr.trim();

  return {
    ok: true,
    output: result.stdout,
    ...(warning ? { warning } : {}),
  };
}
