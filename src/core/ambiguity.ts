import type { Grammar } from "../types/cfg";
import { parseAllWithBounds } from "./parse";
import type { ParseTreeNode } from "../types/cfg";

export type StringAmbiguityResult = {
  ambiguous: boolean;
  note: string;
  trees: ParseTreeNode[];
};

export type GrammarAmbiguityResult = {
  ambiguous: boolean;
  note: string;
  witnessTokens?: string[];
  witnessTrees?: ParseTreeNode[];
};

type GrammarAmbiguityOptions = {
  maxTerminalLength?: number;
  maxDerivationDepth?: number;
  maxSententialStates?: number;
  maxCandidateStrings?: number;
  parseMaxDepth?: number;
  parseMaxNodes?: number;
};

type EnumerateResult = {
  candidates: string[][];
  cutOff: boolean;
};

const sententialKey = (symbols: string[]): string => symbols.join("\u0001");
const tokensKey = (tokens: string[]): string => tokens.join("\u0001");

const terminalCount = (symbols: string[], nonTerminals: Set<string>): number =>
  symbols.filter((token) => !nonTerminals.has(token)).length;

const enumerateCandidateStrings = (
  grammar: Grammar,
  options: Required<Pick<GrammarAmbiguityOptions, "maxTerminalLength" | "maxDerivationDepth" | "maxSententialStates" | "maxCandidateStrings">>,
): EnumerateResult => {
  const queue: Array<{ symbols: string[]; depth: number }> = [{ symbols: [grammar.startSymbol], depth: 0 }];
  const visited = new Set<string>([sententialKey([grammar.startSymbol])]);
  const candidates: string[][] = [];
  const seenCandidates = new Set<string>();
  let cutOff = false;

  while (queue.length) {
    if (visited.size > options.maxSententialStates || candidates.length >= options.maxCandidateStrings) {
      cutOff = true;
      break;
    }

    const current = queue.shift()!;
    if (current.depth > options.maxDerivationDepth) {
      cutOff = true;
      continue;
    }

    if (terminalCount(current.symbols, grammar.nonTerminals) > options.maxTerminalLength) {
      continue;
    }

    const ntIndex = current.symbols.findIndex((symbol) => grammar.nonTerminals.has(symbol));
    if (ntIndex === -1) {
      const key = tokensKey(current.symbols);
      if (!seenCandidates.has(key)) {
        seenCandidates.add(key);
        candidates.push(current.symbols);
      }
      continue;
    }

    const ntSymbol = current.symbols[ntIndex];
    const expansions = grammar.productions.get(ntSymbol) ?? [];
    for (const rhs of expansions) {
      const next = [...current.symbols.slice(0, ntIndex), ...rhs, ...current.symbols.slice(ntIndex + 1)];
      if (terminalCount(next, grammar.nonTerminals) > options.maxTerminalLength) {
        continue;
      }
      const key = sententialKey(next);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push({ symbols: next, depth: current.depth + 1 });
    }
  }

  return { candidates, cutOff };
};

export const detectStringAmbiguity = (grammar: Grammar, inputTokens: string[]): StringAmbiguityResult => {
  const search = parseAllWithBounds(grammar, inputTokens, {
    stopAfter: 2,
    maxDepth: 50,
    maxNodes: 20000,
  });

  if (search.trees.length > 1) {
    return {
      ambiguous: true,
      note: "Multiple parse trees found for this input string.",
      trees: search.trees,
    };
  }

  const boundedText = search.reason
    ? `Bounded input parse note: ${search.reason}`
    : "Bounded input parse note: no alternate parse tree found for this string.";

  return {
    ambiguous: false,
    note: boundedText,
    trees: search.trees,
  };
};

export const detectGrammarAmbiguity = (
  grammar: Grammar,
  options: GrammarAmbiguityOptions = {},
): GrammarAmbiguityResult => {
  const config = {
    maxTerminalLength: options.maxTerminalLength ?? 8,
    maxDerivationDepth: options.maxDerivationDepth ?? 16,
    maxSententialStates: options.maxSententialStates ?? 12000,
    maxCandidateStrings: options.maxCandidateStrings ?? 240,
    parseMaxDepth: options.parseMaxDepth ?? 50,
    parseMaxNodes: options.parseMaxNodes ?? 20000,
  };

  const enumerated = enumerateCandidateStrings(grammar, config);
  let parseCutOff = false;

  for (const candidate of enumerated.candidates) {
    const parsed = parseAllWithBounds(grammar, candidate, {
      stopAfter: 2,
      maxDepth: config.parseMaxDepth,
      maxNodes: config.parseMaxNodes,
    });
    if (parsed.reason) {
      parseCutOff = true;
    }
    if (parsed.trees.length > 1) {
      return {
        ambiguous: true,
        note: `Grammar is ambiguous. Witness string: "${candidate.join(" ")}".`,
        witnessTokens: candidate,
        witnessTrees: parsed.trees,
      };
    }
  }

  const bounded =
    enumerated.cutOff || parseCutOff
      ? "No ambiguous witness found within bounded search limits."
      : "No ambiguous witness found for explored derivable strings.";

  return {
    ambiguous: false,
    note: bounded,
  };
};
