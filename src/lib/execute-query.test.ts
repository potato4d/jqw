import { describe, expect, it, vi } from "vitest";
import {
  describeJsonError,
  executeQuery,
  type JqHandle,
} from "./execute-query";

function createJq(result: {
  stdout: string;
  stderr?: string;
  exitCode?: number;
}): JqHandle {
  return {
    raw: vi.fn().mockReturnValue({
      stdout: result.stdout,
      stderr: result.stderr ?? "",
      exitCode: result.exitCode ?? 0,
    }),
  };
}

describe("executeQuery", () => {
  it("rejects an empty query without calling jq", () => {
    const jq = createJq({ stdout: "" });

    expect(executeQuery(jq, "{}", "  ", 100)).toEqual({
      ok: false,
      error: {
        kind: "query",
        title: "Query required",
        message: "Enter a jq query to transform the input.",
      },
    });
    expect(jq.raw).not.toHaveBeenCalled();
  });

  it("accepts exactly one valid JSON value and preserves its source text", () => {
    const jq = createJq({ stdout: "1e400" });

    expect(executeQuery(jq, "1e400", ".", 100)).toEqual({
      ok: true,
      output: "1e400",
    });
    expect(jq.raw).toHaveBeenCalledWith("1e400", ".");
  });

  it.each(["", "1 2", "NaN", "01"])(
    "rejects non-JSON input %j before jq executes",
    (input) => {
      const jq = createJq({ stdout: "" });
      const result = executeQuery(jq, input, ".", 100);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("input");
      }
      expect(jq.raw).not.toHaveBeenCalled();
    },
  );

  it("reports a jq failure and discards partial output", () => {
    const result = executeQuery(
      createJq({
        stdout: '{"partial":true}',
        stderr: "jq: error: stopped",
        exitCode: 5,
      }),
      "{}",
      ".foo",
      100,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "query",
        title: "jq error",
        message: "jq: error: stopped",
      },
    });
  });

  it("uses the exit code when jq fails without stderr", () => {
    const result = executeQuery(
      createJq({ stdout: "", exitCode: 42 }),
      "{}",
      "halt_error(42)",
      100,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { message: "jq exited with code 42." },
    });
  });

  it("returns successful stderr as a warning", () => {
    expect(
      executeQuery(
        createJq({ stdout: "{}", stderr: '["DEBUG:",{}]' }),
        "{}",
        "debug",
        100,
      ),
    ).toEqual({
      ok: true,
      output: "{}",
      warning: '["DEBUG:",{}]',
    });
  });

  it("enforces the output limit in UTF-8 bytes", () => {
    expect(
      executeQuery(createJq({ stdout: '"日本😀"' }), "{}", ".", 11),
    ).toEqual({
      ok: false,
      error: {
        kind: "output",
        title: "Output too large",
        message: "Output exceeded the 5 MB limit.",
      },
    });
  });
});

describe("describeJsonError", () => {
  it("converts parser offsets into line and column", () => {
    const error = describeJsonError('{\n  "foo": true,\n}', new Error("Unexpected token } in JSON at position 17"));

    expect(error).toMatchObject({
      kind: "input",
      title: "Invalid JSON",
      line: 3,
      column: 1,
    });
  });
});
