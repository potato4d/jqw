import { describe, expect, it } from "vitest";
import { formatJson } from "./format-json";

describe("formatJson", () => {
  it("formats nested JSON with two-space indentation", () => {
    expect(formatJson('{"alpha":1,"items":[true,{"ok":null}],"empty":{}}'))
      .toBe(`{
  "alpha": 1,
  "items": [
    true,
    {
      "ok": null
    }
  ],
  "empty": {}
}`);
  });

  it("preserves number lexemes beyond JavaScript precision", () => {
    expect(formatJson('{"integer":9007199254740993,"huge":1e400}')).toBe(`{
  "integer": 9007199254740993,
  "huge": 1e400
}`);
  });

  it("preserves whitespace and escapes inside strings", () => {
    expect(formatJson('{"text":"a  b, {c}: \\"quoted\\""}')).toBe(
      '{\n  "text": "a  b, {c}: \\"quoted\\""\n}',
    );
  });

  it("throws for invalid JSON", () => {
    expect(() => formatJson('{"nope":}')).toThrow();
  });
});
