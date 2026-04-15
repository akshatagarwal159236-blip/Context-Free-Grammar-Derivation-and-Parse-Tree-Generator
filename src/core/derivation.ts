import type { Grammar, ParseTreeNode } from "../types/cfg";
import { sententialToString } from "./grammarParser";

export type DerivationStep = {
  sentential: string;
  rule?: string;
  expandedNodeId?: number;
};

const leavesFromTree = (node: ParseTreeNode): ParseTreeNode[] => {
  if (!node.children.length) {
    return [node];
  }
  return node.children.flatMap(leavesFromTree);
};

const expandNode = (
  sententialNodes: ParseTreeNode[],
  index: number,
  node: ParseTreeNode,
): ParseTreeNode[] => [
  ...sententialNodes.slice(0, index),
  ...(node.children.length ? node.children : []),
  ...sententialNodes.slice(index + 1),
];

const derive = (
  grammar: Grammar,
  tree: ParseTreeNode,
  selector: (nodes: ParseTreeNode[], nonTerminals: Set<string>) => number,
): DerivationStep[] => {
  const steps: DerivationStep[] = [{ sentential: sententialToString([grammar.startSymbol]) }];
  let sententialNodes = [tree];
  let guard = 0;

  while (guard < 1000) {
    guard += 1;
    const index = selector(sententialNodes, grammar.nonTerminals);
    if (index < 0) {
      break;
    }

    const target = sententialNodes[index];
    const rhs = target.children.map((child) => child.symbol).join(" ") || "epsilon";
    const rule = `${target.symbol} -> ${rhs}`;
    sententialNodes = expandNode(sententialNodes, index, target);
    const symbols = sententialNodes.map((n) => n.symbol);
    steps.push({ sentential: sententialToString(symbols), rule, expandedNodeId: target.id });
  }

  return steps;
};

export const leftmostDerivationWithRules = (grammar: Grammar, tree: ParseTreeNode): DerivationStep[] =>
  derive(grammar, tree, (nodes, nonTerminals) => nodes.findIndex((n) => nonTerminals.has(n.symbol)));

export const rightmostDerivationWithRules = (grammar: Grammar, tree: ParseTreeNode): DerivationStep[] =>
  derive(grammar, tree, (nodes, nonTerminals) => {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      if (nonTerminals.has(nodes[i].symbol)) {
        return i;
      }
    }
    return -1;
  });

export const leftmostDerivation = (grammar: Grammar, tree: ParseTreeNode): string[] =>
  leftmostDerivationWithRules(grammar, tree).map((step) => step.sentential);

export const rightmostDerivation = (grammar: Grammar, tree: ParseTreeNode): string[] =>
  rightmostDerivationWithRules(grammar, tree).map((step) => step.sentential);

export const treeYield = (tree: ParseTreeNode): string[] =>
  leavesFromTree(tree).map((node) => node.symbol);
