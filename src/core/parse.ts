import type { Grammar, ParseResult, ParseTreeNode } from "../types/cfg";

type ParseOptions = {
  maxDepth?: number;
  maxNodes?: number;
  stopAfter?: number;
};

type ParseSearchResult = {
  trees: ParseTreeNode[];
  reason?: string;
};

type SearchState = {
  depth: number;
  createdNodes: number;
};

const cloneNode = (node: ParseTreeNode): ParseTreeNode => ({
  id: node.id,
  symbol: node.symbol,
  children: node.children.map(cloneNode),
});

const hasPrefixMismatch = (
  sentential: string[],
  inputTokens: string[],
  nonTerminals: Set<string>,
): boolean => {
  const terminalPrefix: string[] = [];
  for (const token of sentential) {
    if (nonTerminals.has(token)) {
      break;
    }
    terminalPrefix.push(token);
  }
  for (let i = 0; i < terminalPrefix.length; i += 1) {
    if (inputTokens[i] !== terminalPrefix[i]) {
      return true;
    }
  }
  return false;
};

const terminalCount = (sentential: string[], nonTerminals: Set<string>): number =>
  sentential.filter((token) => !nonTerminals.has(token)).length;

export const parseAllWithBounds = (
  grammar: Grammar,
  inputTokens: string[],
  options: ParseOptions = {},
): ParseSearchResult => {
  const maxDepth = options.maxDepth ?? 40;
  const maxNodes = options.maxNodes ?? 10000;
  const stopAfter = options.stopAfter ?? 2;

  let nodeId = 0;
  const root: ParseTreeNode = { id: nodeId++, symbol: grammar.startSymbol, children: [] };
  const trees: ParseTreeNode[] = [];
  let cutoffReason = "";

  const dfs = (sentential: string[], frontierNodes: ParseTreeNode[], state: SearchState): void => {
    if (trees.length >= stopAfter) {
      return;
    }
    if (state.depth > maxDepth) {
      cutoffReason = cutoffReason || "Parsing stopped due to recursion depth limit.";
      return;
    }
    if (state.createdNodes > maxNodes) {
      cutoffReason = cutoffReason || "Parsing stopped due to node exploration limit.";
      return;
    }
    if (hasPrefixMismatch(sentential, inputTokens, grammar.nonTerminals)) {
      return;
    }
    if (terminalCount(sentential, grammar.nonTerminals) > inputTokens.length) {
      return;
    }

    const ntIndex = sentential.findIndex((sym) => grammar.nonTerminals.has(sym));
    if (ntIndex === -1) {
      if (
        sentential.length === inputTokens.length &&
        sentential.every((token, idx) => token === inputTokens[idx])
      ) {
        trees.push(cloneNode(root));
      }
      return;
    }

    const ntSymbol = sentential[ntIndex];
    const optionsForNt = grammar.productions.get(ntSymbol) ?? [];
    const currentNode = frontierNodes[ntIndex];

    for (const rhs of optionsForNt) {
      const prevChildren = currentNode.children;
      const newChildren = rhs.map((symbol) => ({ id: nodeId++, symbol, children: [] as ParseTreeNode[] }));
      currentNode.children = newChildren;

      const newSentential = [...sentential.slice(0, ntIndex), ...rhs, ...sentential.slice(ntIndex + 1)];
      const newFrontier = [
        ...frontierNodes.slice(0, ntIndex),
        ...newChildren,
        ...frontierNodes.slice(ntIndex + 1),
      ];

      dfs(newSentential, newFrontier, {
        depth: state.depth + 1,
        createdNodes: state.createdNodes + newChildren.length,
      });

      currentNode.children = prevChildren;
      if (trees.length >= stopAfter) {
        return;
      }
    }
  };

  dfs([grammar.startSymbol], [root], { depth: 0, createdNodes: 1 });
  return { trees, reason: cutoffReason || undefined };
};

export const parseInput = (grammar: Grammar, inputTokens: string[]): ParseResult => {
  const result = parseAllWithBounds(grammar, inputTokens, { stopAfter: 1 });
  if (!result.trees.length) {
    return {
      accepted: false,
      reason: result.reason ?? "Input string cannot be derived by this grammar.",
    };
  }
  return { accepted: true, tree: result.trees[0] };
};
