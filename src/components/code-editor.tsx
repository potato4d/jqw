import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView, keymap } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onRun?: () => void;
  theme: "light" | "dark";
  label: string;
  readOnly?: boolean;
  validateJson?: boolean;
  placeholder?: string;
  testId?: string;
}

export function CodeEditor({
  value,
  onChange,
  onRun,
  theme,
  label,
  readOnly = false,
  validateJson = false,
  placeholder,
  testId,
}: CodeEditorProps) {
  const extensions = useMemo(
    () => [
      json(),
      EditorView.contentAttributes.of({
        "aria-label": label,
        ...(readOnly ? { "aria-readonly": "true" } : {}),
      }),
      ...(validateJson ? [linter(jsonParseLinter(), { delay: 200 })] : []),
      ...(onRun
        ? [
            keymap.of([
              {
                key: "Mod-Enter",
                preventDefault: true,
                run: () => {
                  onRun();
                  return true;
                },
              },
            ]),
          ]
        : []),
    ],
    [label, onRun, readOnly, validateJson],
  );

  return (
    <div className="code-editor" data-testid={testId}>
      <CodeMirror
        value={value}
        height="100%"
        theme={theme}
        extensions={extensions}
        readOnly={readOnly}
        editable={!readOnly}
        onChange={onChange}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: !readOnly,
          highlightActiveLine: !readOnly,
          foldGutter: false,
          dropCursor: !readOnly,
          allowMultipleSelections: !readOnly,
          autocompletion: false,
          rectangularSelection: false,
        }}
      />
    </div>
  );
}
