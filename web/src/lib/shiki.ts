import { codeToHtml } from "shiki";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
} from "@shikijs/transformers";

/**
 * Renders Rust source to highlighted HTML at request/build time. Server-side
 * only — never bundle Shiki into the client.
 */
export async function highlightRust(source: string): Promise<string> {
  return codeToHtml(source, {
    lang: "rust",
    theme: "github-dark",
    transformers: [
      transformerNotationDiff(),
      transformerNotationHighlight(),
    ],
  });
}
