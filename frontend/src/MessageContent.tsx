
import type { ReactNode } from "react";

type MessageBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "ordered-list"; items: string[] }
  | { type: "unordered-list"; items: string[] };

function renderInline(text: string): ReactNode[] {
  const tokenPattern =
    /(\*\*.+?\*\*|__.+?__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

  return text.split(tokenPattern).map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("__") && part.endsWith("__")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code className="message-inline-code" key={index}>
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);

    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return part;
  });
}

function parseMessage(source: string): MessageBlock[] {
  const normalized = source
    .replace(/\r\n?/g, "\n")
    // Separate numbered steps that arrived on the same line.
    .replace(/[ \t]+(?=\d+\.\s+\*\*)/g, "\n")
    // Separate inline dash or bullet lists.
    .replace(/[ \t]+(?=[-•]\s+(?:\*\*|[A-Z]))/g, "\n")
    // Separate Markdown headings.
    .replace(/[ \t]+(?=#{1,3}\s+)/g, "\n");

  const blocks: MessageBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listType: "ordered-list" | "unordered-list" | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length) {
      blocks.push({
        type: "paragraph",
        text: paragraphLines.join(" ").trim(),
      });
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listType && listItems.length) {
      blocks.push({
        type: listType,
        items: [...listItems],
      });
    }

    listItems = [];
    listType = null;
  };

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const unordered = line.match(/^[-•*]\s+(.+)$/);

    if (ordered || unordered) {
      flushParagraph();

      const nextType = ordered ? "ordered-list" : "unordered-list";

      if (listType && listType !== nextType) {
        flushList();
      }

      listType = nextType;
      listItems.push((ordered ?? unordered)![1]);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

export default function MessageContent({ text }: { text: string }) {
  const blocks = parseMessage(text);

  return (
    <div className="message-rich-text">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h4 className="message-markdown-heading" key={index}>
              {renderInline(block.text)}
            </h4>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol className="message-markdown-ordered-list" key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul className="message-markdown-unordered-list" key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p className="message-markdown-paragraph" key={index}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
