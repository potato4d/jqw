import { useCallback, useEffect, useRef, useState } from "react";
import {
  INITIAL_QUERY_STATE,
  QueryRunner,
  type QueryRunnerState,
} from "@/lib/query-runner";

export function useJqRunner(input: string, query: string) {
  const [state, setState] = useState<QueryRunnerState>(INITIAL_QUERY_STATE);
  const runnerRef = useRef<QueryRunner | null>(null);

  useEffect(() => {
    runnerRef.current = new QueryRunner(
      () =>
        new Worker(new URL("../workers/jq.worker.ts", import.meta.url), {
          type: "module",
          name: "jqw-query",
        }),
      setState,
    );

    return () => {
      runnerRef.current?.dispose();
      runnerRef.current = null;
    };
  }, []);

  useEffect(() => {
    runnerRef.current?.schedule(input, query);
  }, [input, query]);

  const runNow = useCallback(() => {
    runnerRef.current?.runNow(input, query);
  }, [input, query]);

  const stop = useCallback(() => {
    runnerRef.current?.stop();
  }, []);

  return { state, runNow, stop };
}
