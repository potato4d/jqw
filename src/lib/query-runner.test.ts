import { afterEach, describe, expect, it, vi } from "vitest";
import type { JqWorkerResponse } from "./jq-worker-protocol";
import {
  QueryRunner,
  type QueryRunnerState,
  type WorkerLike,
} from "./query-runner";

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<JqWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  respond(response: JqWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<JqWorkerResponse>);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("QueryRunner", () => {
  it("debounces a scheduled query", () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const states: QueryRunnerState[] = [];
    const runner = new QueryRunner(() => worker, (state) => states.push(state));

    runner.schedule("{}", ".");
    expect(worker.postMessage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(249);
    expect(worker.postMessage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "run", input: "{}", query: "." }),
    );
    expect(states.at(-1)?.phase).toBe("running");
  });

  it("reveals Stop at five seconds and force-stops at thirty", () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const states: QueryRunnerState[] = [];
    const runner = new QueryRunner(() => worker, (state) => states.push(state));

    runner.runNow("{}", "recurse(.)");
    vi.advanceTimersByTime(5_000);
    expect(states.at(-1)).toMatchObject({ phase: "running", canStop: true });

    vi.advanceTimersByTime(25_000);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(states.at(-1)).toMatchObject({
      phase: "error",
      error: { title: "Query timed out" },
    });
  });

  it("terminates a running worker when a new edit is scheduled", () => {
    vi.useFakeTimers();
    const firstWorker = new FakeWorker();
    const workers = [firstWorker, new FakeWorker()];
    const runner = new QueryRunner(
      () => workers.shift()!,
      vi.fn(),
      { debounceMs: 10 },
    );

    runner.runNow("{}", ".");
    runner.schedule('{"changed":true}', ".changed");
    expect(firstWorker.terminate).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10);
    expect(workers).toHaveLength(0);
  });

  it("ignores an error queued by a worker that was replaced", () => {
    vi.useFakeTimers();
    const firstWorker = new FakeWorker();
    const secondWorker = new FakeWorker();
    const states: QueryRunnerState[] = [];
    const workers = [firstWorker, secondWorker];
    const runner = new QueryRunner(
      () => workers.shift()!,
      (state) => states.push(state),
      { debounceMs: 10 },
    );

    runner.runNow("{}", ".");
    const queuedError = firstWorker.onerror;
    runner.schedule('{"changed":true}', ".changed");
    vi.advanceTimersByTime(10);

    queuedError?.({ message: "late failure" } as ErrorEvent);

    expect(secondWorker.terminate).not.toHaveBeenCalled();
    expect(states.at(-1)?.phase).toBe("running");
  });

  it("ignores stale responses and publishes the active result", () => {
    const worker = new FakeWorker();
    const states: QueryRunnerState[] = [];
    const runner = new QueryRunner(() => worker, (state) => states.push(state));

    runner.runNow("{}", ".");
    worker.respond({ type: "result", id: 99, output: "stale" });
    expect(states.at(-1)?.phase).toBe("running");

    worker.respond({ type: "result", id: 1, output: "{}" });
    expect(states.at(-1)).toMatchObject({ phase: "success", output: "{}" });
  });

  it("stops a running query on demand", () => {
    const worker = new FakeWorker();
    const states: QueryRunnerState[] = [];
    const runner = new QueryRunner(() => worker, (state) => states.push(state));

    runner.runNow("{}", ".");
    runner.stop();

    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(states.at(-1)).toMatchObject({
      phase: "stopped",
      error: { title: "Query stopped" },
    });
  });

  it("discards a failed worker so the next run can retry", () => {
    const firstWorker = new FakeWorker();
    const secondWorker = new FakeWorker();
    const workers = [firstWorker, secondWorker];
    const runner = new QueryRunner(() => workers.shift()!, vi.fn());

    runner.runNow("{}", ".");
    firstWorker.respond({
      type: "error",
      id: 1,
      error: {
        kind: "internal",
        title: "Couldn’t run jq",
        message: "Wasm failed to load.",
      },
    });
    runner.runNow("{}", ".");

    expect(firstWorker.terminate).toHaveBeenCalledOnce();
    expect(secondWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
    );
  });
});
