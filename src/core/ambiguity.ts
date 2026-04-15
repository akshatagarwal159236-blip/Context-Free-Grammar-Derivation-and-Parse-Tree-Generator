import type { Grammar } from "../types/cfg";
import { parseAllWithBounds } from "./parse";
import type { ParseTreeNode } from "../types/cfg";

export type AmbiguityResult = {
  ambiguous: boolean;
  note: string;
  trees: ParseTreeNode[];
};

export const detectAmbiguity = (grammar: Grammar, inputTokens: string[]): AmbiguityResult => {
  const search = parseAllWithBounds(grammar, inputTokens, {
    stopAfter: 2,
    maxDepth: 50,
    maxNodes: 20000,
  });

  if (search.trees.length > 1) {
    return {
      ambiguous: true,
      note: "Grammar appears ambiguous for this string (multiple parse trees found).",
      trees: search.trees,
    };
  }

  const boundedText = search.reason
    ? `Bounded search note: ${search.reason}`
    : "Bounded search note: no alternate parse tree found within limits.";

  return {
    ambiguous: false,
    note: boundedText,
    trees: search.trees,
  };
};
