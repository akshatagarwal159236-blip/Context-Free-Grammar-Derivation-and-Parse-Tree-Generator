export type Production = {
  lhs: string;
  rhsOptions: string[][];
};

export type Grammar = {
  startSymbol: string;
  productions: Map<string, string[][]>;
  nonTerminals: Set<string>;
  terminals: Set<string>;
};

export type ParseTreeNode = {
  id: number;
  symbol: string;
  children: ParseTreeNode[];
};

export type ParseSuccess = {
  accepted: true;
  tree: ParseTreeNode;
};

export type ParseFailure = {
  accepted: false;
  reason: string;
};

export type ParseResult = ParseSuccess | ParseFailure;
