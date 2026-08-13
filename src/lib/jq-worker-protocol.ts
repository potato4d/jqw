export const OUTPUT_LIMIT_BYTES = 5 * 1024 * 1024;

export type QueryErrorKind = "input" | "query" | "output" | "internal";

export interface QueryErrorInfo {
  kind: QueryErrorKind;
  title: string;
  message: string;
  line?: number;
  column?: number;
}

export interface RunQueryMessage {
  type: "run";
  id: number;
  input: string;
  query: string;
  outputLimitBytes: number;
}

export interface QueryResultMessage {
  type: "result";
  id: number;
  output: string;
  warning?: string;
}

export interface QueryErrorMessage {
  type: "error";
  id: number;
  error: QueryErrorInfo;
}

export type JqWorkerResponse = QueryResultMessage | QueryErrorMessage;
