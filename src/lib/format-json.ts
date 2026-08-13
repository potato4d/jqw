function nextNonWhitespace(source: string, start: number) {
  for (let index = start; index < source.length; index += 1) {
    if (!/\s/.test(source[index])) {
      return source[index];
    }
  }

  return undefined;
}

function previousNonWhitespace(source: string, start: number) {
  for (let index = start; index >= 0; index -= 1) {
    if (!/\s/.test(source[index])) {
      return source[index];
    }
  }

  return undefined;
}

/**
 * Formats JSON without parsing values back into JavaScript representations.
 * This preserves number lexemes such as 9007199254740993 and 1e400 exactly.
 */
export function formatJson(source: string) {
  JSON.parse(source);

  let result = "";
  let indentation = 0;
  let inString = false;
  let escaping = false;

  const newline = () => `\n${"  ".repeat(indentation)}`;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      result += character;
      if (escaping) {
        escaping = false;
      } else if (character === "\\") {
        escaping = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (/\s/.test(character)) {
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }

    if (character === "{" || character === "[") {
      result += character;
      const closingCharacter = character === "{" ? "}" : "]";
      if (nextNonWhitespace(source, index + 1) !== closingCharacter) {
        indentation += 1;
        result += newline();
      }
      continue;
    }

    if (character === "}" || character === "]") {
      const openingCharacter = character === "}" ? "{" : "[";
      const previousCharacter = previousNonWhitespace(source, index - 1);
      if (previousCharacter !== openingCharacter) {
        indentation -= 1;
        result += newline();
      }
      result += character;
      continue;
    }

    if (character === ",") {
      result += `,${newline()}`;
      continue;
    }

    if (character === ":") {
      result += ": ";
      continue;
    }

    result += character;
  }

  return result;
}
