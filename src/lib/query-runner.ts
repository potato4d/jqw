import {
  OUTPUT_LIMIT_BYTES,
  type JqWorkerResponse,
  type QueryErrorInfo,
  type RunQueryMessage,
} from "./jq-worker-protocol";

export type QueryPhase =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "stopped";

export interface QueryRunnerState {
  phase: QueryPhase;
  output: string;
  error?: QueryErrorInfo;
  warning?: string;
  canStop: boolean;
}

export const INITIAL_QUERY_STATE: QueryRunnerState = {
  phase: "pending",
  output: "",
  canStop: false,
};

export interface WorkerLike {
  onmessage: ((event: MessageEvent<JqWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: RunQueryMessage): void;
  terminate(): void;
}

type WorkerFactory = () => WorkerLike;
type StateListener = (state: QueryRunnerState) => void;

interface QueryRunnerOptions {
  debounceMs?: number;
  revealStopAfterMs?: number;
  forceStopAfterMs?: number;
  outputLimitBytes?: number;
}

export class QueryRunner {
  private readonly debounceMs: number;
  private readonly revealStopAfterMs: number;
  private readonly forceStopAfterMs: number;
  private readonly outputLimitBytes: number;
  private worker: WorkerLike | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private revealStopTimer: ReturnType<typeof setTimeout> | null = null;
  private forceStopTimer: ReturnType<typeof setTimeout> | null = null;
  private requestSequence = 0;
  private activeRequestId: number | null = null;

  constructor(
    private readonly createWorker: WorkerFactory,
    private readonly onStateChange: StateListener,
    options: QueryRunnerOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? 250;
    this.revealStopAfterMs = options.revealStopAfterMs ?? 5_000;
    this.forceStopAfterMs = options.forceStopAfterMs ?? 30_000;
    this.outputLimitBytes = options.outputLimitBytes ?? OUTPUT_LIMIT_BYTES;
  }

  schedule(input: string, query: string) {
    this.clearDebounceTimer();
    this.cancelActiveRun();
    this.onStateChange(INITIAL_QUERY_STATE);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.start(input, query);
    }, this.debounceMs);
  }

  runNow(input: string, query: string) {
    this.clearDebounceTimer();
    this.cancelActiveRun();
    this.start(input, query);
  }

  stop() {
    if (this.activeRequestId === null) {
      return;
    }

    this.cancelActiveRun();
    this.onStateChange({
      phase: "stopped",
      output: "",
      error: {
        kind: "internal",
        title: "Query stopped",
        message: "The running query was stopped.",
      },
      canStop: false,
    });
  }

  dispose() {
    this.clearDebounceTimer();
    this.clearRunTimers();
    this.activeRequestId = null;
    this.worker?.terminate();
    this.worker = null;
  }

  private start(input: string, query: string) {
    const worker = this.ensureWorker();
    const id = ++this.requestSequence;
    this.activeRequestId = id;
    this.onStateChange({
      phase: "running",
      output: "",
      canStop: false,
    });

    this.revealStopTimer = setTimeout(() => {
      if (this.activeRequestId === id) {
        this.onStateChange({
          phase: "running",
          output: "",
          canStop: true,
        });
      }
    }, this.revealStopAfterMs);

    this.forceStopTimer = setTimeout(() => {
      if (this.activeRequestId !== id) {
        return;
      }

      this.cancelActiveRun();
      this.onStateChange({
        phase: "error",
        output: "",
        error: {
          kind: "internal",
          title: "Query timed out",
          message: "The query was stopped after 30 seconds.",
        },
        canStop: false,
      });
    }, this.forceStopAfterMs);

    worker.postMessage({
      type: "run",
      id,
      input,
      query,
      outputLimitBytes: this.outputLimitBytes,
    });
  }

  private ensureWorker() {
    if (this.worker) {
      return this.worker;
    }

    const worker = this.createWorker();
    worker.onmessage = (event) => this.handleResponse(event.data);
    worker.onerror = (event) => {
      if (this.activeRequestId === null || this.worker !== worker) {
        return;
      }

      this.activeRequestId = null;
      this.clearRunTimers();
      worker.terminate();
      this.worker = null;
      this.onStateChange({
        phase: "error",
        output: "",
        error: {
          kind: "internal",
          title: "Worker error",
          message: event.message || "The jq worker failed unexpectedly.",
        },
        canStop: false,
      });
    };
    this.worker = worker;

    return worker;
  }

  private handleResponse(response: JqWorkerResponse) {
    if (response.id !== this.activeRequestId) {
      return;
    }

    this.activeRequestId = null;
    this.clearRunTimers();

    if (response.type === "error") {
      if (response.error.kind === "internal") {
        this.worker?.terminate();
        this.worker = null;
      }
      this.onStateChange({
        phase: "error",
        output: "",
        error: response.error,
        canStop: false,
      });
      return;
    }

    this.onStateChange({
      phase: "success",
      output: response.output,
      ...(response.warning ? { warning: response.warning } : {}),
      canStop: false,
    });
  }

  private cancelActiveRun() {
    if (this.activeRequestId === null) {
      return;
    }

    this.activeRequestId = null;
    this.clearRunTimers();
    this.worker?.terminate();
    this.worker = null;
  }

  private clearDebounceTimer() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private clearRunTimers() {
    if (this.revealStopTimer !== null) {
      clearTimeout(this.revealStopTimer);
      this.revealStopTimer = null;
    }
    if (this.forceStopTimer !== null) {
      clearTimeout(this.forceStopTimer);
      this.forceStopTimer = null;
    }
  }
}
