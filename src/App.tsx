import { Braces } from "lucide-react";

export function App() {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <section className="flex items-center gap-3" aria-label="jqw is loading">
        <span className="grid size-10 place-items-center rounded-xl bg-foreground text-background">
          <Braces aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">jqw</h1>
          <p className="text-sm text-muted-foreground">
            Transform JSON locally in your browser.
          </p>
        </div>
      </section>
    </main>
  );
}
