import type { Grammar } from "../types/cfg";

const RULE_SEPARATOR = "->";

const isNonTerminal = (token: string): boolean => /^[A-Z][A-Z0-9_]*$/.test(token);

const normalizeToken = (token: string): string => token.trim();

const sortSymbolsLongestFirst = (symbols: Set<string>): string[] =>
  [...symbols].sort((a, b) => b.length - a.length);

const lexConcatenatedSymbols = (str: string, vocabulary: Set<string>, context: string): string[] => {
  const sorted = sortSymbolsLongestFirst(vocabulary);
  const out: string[] = [];
  let i = 0;
  while (i < str.length) {
    let matched = false;
    for (const sym of sorted) {
      if (str.startsWith(sym, i)) {
        out.push(sym);
        i += sym.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const snippet = str.slice(Math.max(0, i - 6), Math.min(str.length, i + 6));
      throw new Error(
        `${context}: cannot split "${str}" at position ${i + 1} (near "${snippet}"). No symbol matches; use spaces between symbols or add them to V and Σ.`,
      );
    }
  }
  return out;
};

const parseRhsOption = (rhs: string, vocabulary: Set<string> | null): string[] => {
  const trimmed = rhs.trim();
  if (!trimmed || trimmed === "epsilon") {
    return [];
  }
  const segments = trimmed.split(/\s+/).map(normalizeToken).filter(Boolean);
  if (!vocabulary || vocabulary.size === 0) {
    return segments;
  }
  const out: string[] = [];
  for (const seg of segments) {
    if (vocabulary.has(seg)) {
      out.push(seg);
    } else {
      out.push(...lexConcatenatedSymbols(seg, vocabulary, "Right-hand side"));
    }
  }
  return out;
};

export type GrammarConfig = {
  nonTerminalsRaw?: string;
  terminalsRaw?: string;
  startSymbolRaw?: string;
};

const splitSetInput = (raw: string): string[] =>
  raw
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const parseSymbolSet = (raw: string, label: string): Set<string> => {
  const values = splitSetInput(raw);
  if (!values.length) {
    throw new Error(`${label} cannot be empty.`);
  }
  return new Set(values);
};

export const parseGrammar = (rawRules: string, config: GrammarConfig = {}): Grammar => {
  const lines = rawRules
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Grammar is empty.");
  }

  const productions = new Map<string, string[][]>();
  const providedNonTerminals = config.nonTerminalsRaw
    ? parseSymbolSet(config.nonTerminalsRaw, "Non-terminal set")
    : null;
  const providedTerminals = config.terminalsRaw ? parseSymbolSet(config.terminalsRaw, "Terminal set") : null;
  const nonTerminals = providedNonTerminals ?? new Set<string>();
  const terminals = providedTerminals ?? new Set<string>();
  let startSymbol = config.startSymbolRaw?.trim() ?? "";

  if (startSymbol && providedNonTerminals && !providedNonTerminals.has(startSymbol)) {
    throw new Error(`Start symbol "${startSymbol}" must be included in non-terminal set.`);
  }

  const rhsVocabulary =
    providedNonTerminals && providedTerminals
      ? new Set<string>([...providedNonTerminals, ...providedTerminals])
      : null;

  for (const line of lines) {
    const split = line.split(RULE_SEPARATOR);
    if (split.length !== 2) {
      throw new Error(`Invalid rule: "${line}". Use "A -> ...".`);
    }

    const lhs = split[0].trim();
    const rhsRaw = split[1].trim();

    if (!isNonTerminal(lhs) && !providedNonTerminals) {
      throw new Error(`Invalid non-terminal "${lhs}". Use uppercase symbols like S or EXPR.`);
    }
    if (!rhsRaw.length) {
      throw new Error(`Rule "${line}" has empty right-hand side.`);
    }

    if (!startSymbol) {
      startSymbol = lhs;
    }

    if (providedNonTerminals && !providedNonTerminals.has(lhs)) {
      throw new Error(`LHS symbol "${lhs}" is not present in the non-terminal set.`);
    }
    nonTerminals.add(lhs);

    const rhsOptions = rhsRaw
      .split("|")
      .map((option) => parseRhsOption(option, rhsVocabulary))
      .filter((opt) => opt.length >= 0);

    const existing = productions.get(lhs) ?? [];
    productions.set(lhs, [...existing, ...rhsOptions]);
  }

  for (const [lhs, options] of productions.entries()) {
    options.forEach((opt) => {
      opt.forEach((token) => {
        if (isNonTerminal(token) && !nonTerminals.has(token)) {
          throw new Error(
            `Rule for "${lhs}" references non-terminal "${token}" but no production is defined for it.`,
          );
        }
        if (providedNonTerminals && providedNonTerminals.has(token) && !nonTerminals.has(token)) {
          throw new Error(`Rule for "${lhs}" references non-terminal "${token}" without a production.`);
        }
        if (providedTerminals && !providedTerminals.has(token) && !nonTerminals.has(token)) {
          throw new Error(
            `Symbol "${token}" in rule "${lhs}" is not in terminal or non-terminal set.`,
          );
        }
        if (!nonTerminals.has(token)) {
          terminals.add(token);
        }
      });
    });
  }

  if (!startSymbol) {
    throw new Error("Start symbol is required.");
  }
  if (!nonTerminals.has(startSymbol)) {
    throw new Error(`Start symbol "${startSymbol}" does not have a production rule.`);
  }

  if (providedNonTerminals) {
    providedNonTerminals.forEach((symbol) => {
      if (!nonTerminals.has(symbol)) {
        throw new Error(`Non-terminal "${symbol}" has no production rule.`);
      }
    });
  }

  return { startSymbol, productions, nonTerminals, terminals };
};

export const tokenizeInput = (input: string, terminals?: Set<string>): string[] => {
  const trimmed = input.trim();
  if (!trimmed.length) {
    return [];
  }
  if (!terminals || terminals.size === 0) {
    return trimmed.includes(" ") ? trimmed.split(/\s+/).filter(Boolean) : trimmed.split("");
  }
  const sorted = sortSymbolsLongestFirst(terminals);
  const lexInput = (str: string): string[] => {
    const out: string[] = [];
    let i = 0;
    while (i < str.length) {
      let matched = false;
      for (const t of sorted) {
        if (str.startsWith(t, i)) {
          out.push(t);
          i += t.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        throw new Error(
          `Input string: cannot lex at position ${i + 1} — no terminal symbol matches (check Σ and spacing).`,
        );
      }
    }
    return out;
  };
  if (trimmed.includes(" ")) {
    return trimmed
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((part) => (terminals.has(part) ? [part] : lexInput(part)));
  }
  return lexInput(trimmed);
};

export const sententialToString = (symbols: string[]): string =>
  symbols.length ? symbols.join(" ") : "epsilon";
