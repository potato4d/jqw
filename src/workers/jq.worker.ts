/// <reference lib="webworker" />

import { loadJq } from "jq-wasm";
import wasmUrl from "jq-wasm/jq.wasm?url";
import { executeQuery } from "@/lib/execute-query";
import type {
  JqWorkerResponse,
  RunQueryMessage,
} from "@/lib/jq-worker-protocol";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const jqPromise = loadJq({ wasmURL: wasmUrl });

workerScope.onmessage = async (event: MessageEvent<RunQueryMessage>) => {
  const message = event.data;

  if (message.type !== "run") {
    return;
  }

  try {
    const jq = await jqPromise;
    const result = executeQuery(
      jq,
      message.input,
      message.query,
      message.outputLimitBytes,
    );
    const response: JqWorkerResponse = result.ok
      ? {
          type: "result",
          id: message.id,
          output: result.output,
          ...(result.warning ? { warning: result.warning } : {}),
        }
      : { type: "error", id: message.id, error: result.error };

    workerScope.postMessage(response);
  } catch (error) {
    const response: JqWorkerResponse = {
      type: "error",
      id: message.id,
      error: {
        kind: "internal",
        title: "Couldn’t run jq",
        message:
          error instanceof Error
            ? error.message
            : "The jq engine failed unexpectedly.",
      },
    };

    workerScope.postMessage(response);
  }
};

export {};
