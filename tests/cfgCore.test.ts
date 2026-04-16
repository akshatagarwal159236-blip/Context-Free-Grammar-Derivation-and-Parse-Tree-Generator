import { describe, expect, it } from "vitest";
import { detectGrammarAmbiguity } from "../src/core/ambiguity";
import { leftmostDerivation, rightmostDerivation } from "../src/core/derivation";
import { parseGrammar, tokenizeInput } from "../src/core/grammarParser";
import { parseAllWithBounds, parseInput } from "../src/core/parse";

describe("grammar parsing", () => {
  it("parses simple balanced grammar", () => {
    const grammar = parseGrammar("S -> a S b | epsilon");
    expect(grammar.startSymbol).toBe("S");
    expect(grammar.productions.get("S")?.length).toBe(2);
  });

  it("rejects undefined non-terminal references", () => {
    expect(() => parseGrammar("S -> A")).toThrow();
  });

  it("splits concatenated RHS like 0B into terminal 0 and non-terminal B", () => {
    const grammar = parseGrammar("S -> 0B | 1\nB -> epsilon", {
      nonTerminalsRaw: "S, B",
      terminalsRaw: "0, 1",
      startSymbolRaw: "S",
    });
    expect(grammar.productions.get("S")?.[0]).toEqual(["0", "B"]);
    expect(grammar.productions.get("S")?.[1]).toEqual(["1"]);
  });
});

describe("grammar ambiguity detection", () => {
  it("flags ambiguous grammar even when a tested string has a single parse", () => {
    const grammar = parseGrammar("S -> S S | a", {
      nonTerminalsRaw: "S",
      terminalsRaw: "a",
      startSymbolRaw: "S",
    });
    const result = detectGrammarAmbiguity(grammar, {
      maxTerminalLength: 6,
      maxDerivationDepth: 12,
      maxSententialStates: 4000,
      maxCandidateStrings: 120,
    });
    expect(result.ambiguous).toBe(true);
    expect(result.witnessTokens?.length).toBeGreaterThan(0);
    expect(result.witnessTrees?.length).toBeGreaterThan(1);
  });

  it("keeps non-ambiguous balanced grammar as non-ambiguous in bounded search", () => {
    const grammar = parseGrammar("S -> a S b | epsilon");
    const result = detectGrammarAmbiguity(grammar, {
      maxTerminalLength: 8,
      maxDerivationDepth: 12,
      maxSententialStates: 4000,
      maxCandidateStrings: 120,
    });
    expect(result.ambiguous).toBe(false);
  });
});

describe("parse and derivation", () => {
  it("accepts aaabbb with expected derivation shape", () => {
    const grammar = parseGrammar("S -> a S b | epsilon");
    const tokens = tokenizeInput("aaabbb", grammar.terminals);
    expect(tokens).toEqual(["a", "a", "a", "b", "b", "b"]);
    const result = parseInput(grammar, tokens);
    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }

    const left = leftmostDerivation(grammar, result.tree);
    const right = rightmostDerivation(grammar, result.tree);

    expect(left[0]).toBe("S");
    expect(right[0]).toBe("S");
    expect(left[left.length - 1]).toBe("a a a b b b");
    expect(right[right.length - 1]).toBe("a a a b b b");
  });

  it("rejects non-derivable strings", () => {
    const grammar = parseGrammar("S -> a S b | epsilon");
    const tokens = tokenizeInput("aaabb", grammar.terminals);
    const result = parseInput(grammar, tokens);
    expect(result.accepted).toBe(false);
  });

  it("finds two parses and distinct derivations for ambiguous grammar", () => {
    const grammar = parseGrammar("S -> S S | a", {
      nonTerminalsRaw: "S",
      terminalsRaw: "a",
      startSymbolRaw: "S",
    });
    const tokens = tokenizeInput("aaa", grammar.terminals);
    const search = parseAllWithBounds(grammar, tokens, { stopAfter: 2, maxDepth: 50, maxNodes: 20000 });
    expect(search.trees.length).toBe(2);

    const leftA = leftmostDerivation(grammar, search.trees[0]);
    const leftB = leftmostDerivation(grammar, search.trees[1]);
    expect(leftA[leftA.length - 1]).toBe("a a a");
    expect(leftB[leftB.length - 1]).toBe("a a a");
    expect(leftA).not.toEqual(leftB);
  });
});
