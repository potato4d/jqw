import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the jqw identity and local-processing promise", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "jqw" })).toBeInTheDocument();
    expect(
      screen.getByText("Transform JSON locally in your browser."),
    ).toBeInTheDocument();
  });
});
