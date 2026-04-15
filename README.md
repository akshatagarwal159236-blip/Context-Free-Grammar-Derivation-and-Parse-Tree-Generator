# CFG Derivation and Parse Tree App

A frontend TypeScript app that:
- accepts context-free grammar productions and an input string
- computes one valid parse (if accepted)
- shows leftmost and rightmost derivations
- renders a parse tree
- reports best-effort ambiguity detection notes
- when ambiguity is detected, shows two possible parse trees and two distinct leftmost derivations

## Grammar Input Format

- One production per line: `A -> alpha | beta`
- Use uppercase names for non-terminals: `S`, `EXPR`
- Use `epsilon` for empty production
- After you set **Non-terminals** and **Terminals**, symbols in a production can be written **with or without spaces** (e.g. `S -> 0B | 1` is read as `0` then `B`, not one symbol `0B`).
- The input string is also split using **longest-match** on your terminal alphabet (so `01` works if `0` and `1` are terminals; multi-character terminals like `id` are matched before shorter prefixes).
- If you do not use explicit V/Σ fields, keep a **space** between symbols in rules (e.g. `S -> 0 B | 1`).

Example:

```txt
S -> a S b | epsilon
```

## Run Locally

1. Install Node.js (includes npm).
2. Install dependencies:
   - `npm install`
3. Start dev server:
   - `npm run dev`
4. Open the URL shown by Vite.

## Test

- `npm run test`

## Notes and Limitations

- Parsing uses bounded backtracking search to keep runtime finite.
- Ambiguity detection is best effort: it looks for multiple parses within configured limits.
- Deeply recursive or very ambiguous grammars may hit depth/node limits and report bounded-search notes.
