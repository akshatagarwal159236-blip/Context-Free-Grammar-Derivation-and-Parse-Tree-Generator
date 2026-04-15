import { detectAmbiguity } from "./core/ambiguity";
import {
  leftmostDerivationWithRules,
  rightmostDerivationWithRules,
  type DerivationStep,
} from "./core/derivation";
import { parseGrammar, tokenizeInput } from "./core/grammarParser";
import type { ParseTreeNode } from "./types/cfg";
import { renderSteps } from "./ui/renderDerivations";
import { renderParseTree, type TreeRenderHandle } from "./ui/renderTree";

const grammarInput = document.getElementById("grammarInput") as HTMLTextAreaElement;
const nonTerminalInput = document.getElementById("nonTerminalInput") as HTMLInputElement;
const terminalInput = document.getElementById("terminalInput") as HTMLInputElement;
const startSymbolInput = document.getElementById("startSymbolInput") as HTMLInputElement;
const inputString = document.getElementById("inputString") as HTMLInputElement;
const exampleRunButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".example-run-button"),
);
const generateButton = document.getElementById("generateButton") as HTMLButtonElement;
const themeToggleButton = document.getElementById("themeToggleButton") as HTMLButtonElement;
const copyLeftButton = document.getElementById("copyLeftButton") as HTMLButtonElement;
const copyRightButton = document.getElementById("copyRightButton") as HTMLButtonElement;
const leftDetailsButton = document.getElementById("leftDetailsButton") as HTMLButtonElement;
const rightDetailsButton = document.getElementById("rightDetailsButton") as HTMLButtonElement;
const leftTreeAnimationButton = document.getElementById("leftTreeAnimationButton") as HTMLButtonElement;
const rightTreeAnimationButton = document.getElementById("rightTreeAnimationButton") as HTMLButtonElement;
const exportLeftTreeButton = document.getElementById("exportLeftTreeButton") as HTMLButtonElement;
const exportRightTreeButton = document.getElementById("exportRightTreeButton") as HTMLButtonElement;
const stringAcceptedCard = document.getElementById("stringAcceptedCard") as HTMLDivElement;
const stringRejectedCard = document.getElementById("stringRejectedCard") as HTMLDivElement;
const grammarAmbiguousCard = document.getElementById("grammarAmbiguousCard") as HTMLDivElement;
const grammarNonAmbiguousCard = document.getElementById("grammarNonAmbiguousCard") as HTMLDivElement;
const leftDerivationTitle = document.getElementById("leftDerivationTitle") as HTMLHeadingElement;
const rightDerivationTitle = document.getElementById("rightDerivationTitle") as HTMLHeadingElement;
const leftTreeTitle = document.getElementById("leftTreeTitle") as HTMLHeadingElement;
const rightTreeTitle = document.getElementById("rightTreeTitle") as HTMLHeadingElement;
const leftmostList = document.getElementById("leftmostList") as HTMLOListElement;
const rightmostList = document.getElementById("rightmostList") as HTMLOListElement;
const leftTreeContainer = document.getElementById("leftTreeContainer") as HTMLDivElement;
const rightTreeContainer = document.getElementById("rightTreeContainer") as HTMLDivElement;
const ambiguousExtraLeftRow = document.getElementById("ambiguousExtraLeftRow") as HTMLDivElement;
const ambiguousExtraRightRow = document.getElementById("ambiguousExtraRightRow") as HTMLDivElement;
const extraLeftDerivationTitle = document.getElementById("extraLeftDerivationTitle") as HTMLHeadingElement;
const extraRightDerivationTitle = document.getElementById("extraRightDerivationTitle") as HTMLHeadingElement;
const extraLeftTreeTitle = document.getElementById("extraLeftTreeTitle") as HTMLHeadingElement;
const extraRightTreeTitle = document.getElementById("extraRightTreeTitle") as HTMLHeadingElement;
const extraLeftList = document.getElementById("extraLeftList") as HTMLOListElement;
const extraRightList = document.getElementById("extraRightList") as HTMLOListElement;
const extraLeftTreeContainer = document.getElementById("extraLeftTreeContainer") as HTMLDivElement;
const extraRightTreeContainer = document.getElementById("extraRightTreeContainer") as HTMLDivElement;
const toastRegion = document.getElementById("toastRegion") as HTMLDivElement;
const THEME_KEY = "cfg-theme";
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.6;
const ZOOM_STEP = 0.12;
const TREE_REPLAY_DELAY_MS = 2500;

type TreeViewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

const viewportByScrollEl = new WeakMap<HTMLDivElement, TreeViewport>();

const getViewport = (scrollEl: HTMLDivElement): TreeViewport => {
  let v = viewportByScrollEl.get(scrollEl);
  if (!v) {
    v = { scale: 1, offsetX: 0, offsetY: 0 };
    viewportByScrollEl.set(scrollEl, v);
  }
  return v;
};

let panningScrollEl: HTMLDivElement | null = null;
let panAnchorClientX = 0;
let panAnchorClientY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;
let globalPanAttached = false;

let lastLeft: string[] = [];
let lastRight: string[] = [];
let lastLeftDetailed: DerivationStep[] = [];
let lastRightDetailed: DerivationStep[] = [];
let lastExtraLeftDetailed: DerivationStep[] = [];
let lastExtraRightDetailed: DerivationStep[] = [];
let showingAmbiguousExtra = false;
let showLeftDetails = true;
let showRightDetails = true;
let leftTreeSnapshot: ParseTreeNode | null = null;
let rightTreeSnapshot: ParseTreeNode | null = null;
let leftAnimationEnabled = true;
let rightAnimationEnabled = true;
let leftTreeHandle: TreeRenderHandle | null = null;
let rightTreeHandle: TreeRenderHandle | null = null;
let leftReplayTimeoutId: number | null = null;
let rightReplayTimeoutId: number | null = null;
let leftAnimationToken = 0;
let rightAnimationToken = 0;

type ExampleKey =
  | "ambiguous-expression"
  | "rejected-string"
  | "balanced-binary"
  | "a-star-b-star";

type ExampleCase = {
  grammar: string;
  nonTerminals: string;
  terminals: string;
  startSymbol: string;
  input: string;
};

const expansionOrderFromDerivation = (steps: DerivationStep[]): number[] =>
  steps
    .map((step) => step.expandedNodeId)
    .filter((id): id is number => typeof id === "number");

const EXAMPLES: Record<ExampleKey, ExampleCase> = {
  "ambiguous-expression": {
    grammar: "E -> E + E | E * E | e",
    nonTerminals: "E",
    terminals: "e, +, *",
    startSymbol: "E",
    input: "e + e * e",
  },
  "rejected-string": {
    grammar: "S -> a S b | epsilon",
    nonTerminals: "S",
    terminals: "a, b",
    startSymbol: "S",
    input: "aaabb",
  },
  "balanced-binary": {
    grammar: "S -> 0 S 1 | 0 1",
    nonTerminals: "S",
    terminals: "0, 1",
    startSymbol: "S",
    input: "000111",
  },
  "a-star-b-star": {
    grammar: "S -> A B\nA -> a A | a\nB -> b B | b",
    nonTerminals: "S, A, B",
    terminals: "a, b",
    startSymbol: "S",
    input: "aaabbb",
  },
};

const applyExample = (example: ExampleCase): void => {
  grammarInput.value = example.grammar;
  nonTerminalInput.value = example.nonTerminals;
  terminalInput.value = example.terminals;
  startSymbolInput.value = example.startSymbol;
  inputString.value = example.input;
};

type BinaryState = "left" | "right" | "idle";

const setStatusPair = (leftCard: HTMLDivElement, rightCard: HTMLDivElement, state: BinaryState): void => {
  leftCard.classList.toggle("is-active", state === "left");
  rightCard.classList.toggle("is-active", state === "right");
  leftCard.classList.toggle("is-idle", state === "idle");
  rightCard.classList.toggle("is-idle", state === "idle");
};

const animationLabel = (enabled: boolean): string => `Animation: ${enabled ? "On" : "Off"}`;

const syncTreeAnimationButtons = (): void => {
  leftTreeAnimationButton.textContent = animationLabel(leftAnimationEnabled);
  rightTreeAnimationButton.textContent = animationLabel(rightAnimationEnabled);
  leftTreeAnimationButton.classList.toggle("is-active", leftAnimationEnabled);
  rightTreeAnimationButton.classList.toggle("is-active", rightAnimationEnabled);
};

const clearTreePlayback = (side: "left" | "right"): void => {
  if (side === "left") {
    leftAnimationToken += 1;
    if (leftReplayTimeoutId !== null) {
      window.clearTimeout(leftReplayTimeoutId);
      leftReplayTimeoutId = null;
    }
    if (leftTreeHandle) {
      leftTreeHandle.skip();
      leftTreeHandle = null;
    }
    return;
  }

  rightAnimationToken += 1;
  if (rightReplayTimeoutId !== null) {
    window.clearTimeout(rightReplayTimeoutId);
    rightReplayTimeoutId = null;
  }
  if (rightTreeHandle) {
    rightTreeHandle.skip();
    rightTreeHandle = null;
  }
};

const clearAllTreePlayback = (): void => {
  clearTreePlayback("left");
  clearTreePlayback("right");
};

const startTreePlayback = (side: "left" | "right"): void => {
  const isLeft = side === "left";
  const tree = isLeft ? leftTreeSnapshot : rightTreeSnapshot;
  const container = isLeft ? leftTreeContainer : rightTreeContainer;
  const enabled = isLeft ? leftAnimationEnabled : rightAnimationEnabled;
  if (!tree) {
    return;
  }

  clearTreePlayback(side);
  const token = isLeft ? leftAnimationToken : rightAnimationToken;
  const derivationSteps = isLeft ? lastLeftDetailed : lastRightDetailed;
  const handle = renderParseTree(container, tree, {
    animateGrowth: enabled,
    expansionOrder: expansionOrderFromDerivation(derivationSteps),
  });
  if (isLeft) {
    leftTreeHandle = handle;
  } else {
    rightTreeHandle = handle;
  }

  void handle.done.then(() => {
    const activeToken = isLeft ? leftAnimationToken : rightAnimationToken;
    if (token !== activeToken) {
      return;
    }
    if (isLeft) {
      leftTreeHandle = null;
    } else {
      rightTreeHandle = null;
    }
    if (!enabled) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const currentToken = isLeft ? leftAnimationToken : rightAnimationToken;
      if (token !== currentToken) {
        return;
      }
      startTreePlayback(side);
    }, TREE_REPLAY_DELAY_MS);
    if (isLeft) {
      leftReplayTimeoutId = timeoutId;
    } else {
      rightReplayTimeoutId = timeoutId;
    }
  });
};

const detailsLabel = (enabled: boolean): string => `Details: ${enabled ? "On" : "Off"}`;

const syncDetailsButtons = (): void => {
  leftDetailsButton.textContent = detailsLabel(showLeftDetails);
  rightDetailsButton.textContent = detailsLabel(showRightDetails);
  leftDetailsButton.classList.toggle("is-active", showLeftDetails);
  rightDetailsButton.classList.toggle("is-active", showRightDetails);
};

const setAmbiguousExtraVisible = (visible: boolean): void => {
  showingAmbiguousExtra = visible;
  ambiguousExtraLeftRow.classList.toggle("is-hidden", !visible);
  ambiguousExtraRightRow.classList.toggle("is-hidden", !visible);
};

const rerenderDerivationPanels = (): void => {
  renderSteps(leftmostList, lastLeftDetailed, showLeftDetails);
  renderSteps(rightmostList, lastRightDetailed, showRightDetails);
  if (showingAmbiguousExtra) {
    renderSteps(extraLeftList, lastExtraLeftDetailed, showLeftDetails);
    renderSteps(extraRightList, lastExtraRightDetailed, showRightDetails);
  } else {
    renderSteps(extraLeftList, []);
    renderSteps(extraRightList, []);
  }
};

const setDefaultTitles = (): void => {
  leftDerivationTitle.textContent = "Left Derivation";
  rightDerivationTitle.textContent = "Right Derivation";
  leftTreeTitle.textContent = "Left Derivation Tree";
  rightTreeTitle.textContent = "Right Derivation Tree";
  extraLeftDerivationTitle.textContent = "Parse 2 Left Derivation";
  extraRightDerivationTitle.textContent = "Parse 2 Right Derivation";
  extraLeftTreeTitle.textContent = "Parse 2 Left Derivation Tree";
  extraRightTreeTitle.textContent = "Parse 2 Right Derivation Tree";
};

const setAmbiguousTitles = (): void => {
  leftDerivationTitle.textContent = "Parse 1 Left Derivation";
  rightDerivationTitle.textContent = "Parse 1 Right Derivation";
  leftTreeTitle.textContent = "Parse 1 Left Derivation Tree";
  rightTreeTitle.textContent = "Parse 1 Right Derivation Tree";
  extraLeftDerivationTitle.textContent = "Parse 2 Left Derivation";
  extraRightDerivationTitle.textContent = "Parse 2 Right Derivation";
  extraLeftTreeTitle.textContent = "Parse 2 Left Derivation Tree";
  extraRightTreeTitle.textContent = "Parse 2 Right Derivation Tree";
};

const clearOutputs = (): void => {
  clearAllTreePlayback();
  leftTreeSnapshot = null;
  rightTreeSnapshot = null;
  lastLeftDetailed = [];
  lastRightDetailed = [];
  lastExtraLeftDetailed = [];
  lastExtraRightDetailed = [];
  setAmbiguousExtraVisible(false);
  rerenderDerivationPanels();
  leftTreeContainer.innerHTML = "";
  rightTreeContainer.innerHTML = "";
  extraLeftTreeContainer.innerHTML = "";
  extraRightTreeContainer.innerHTML = "";
  setStatusPair(stringAcceptedCard, stringRejectedCard, "idle");
  setStatusPair(grammarAmbiguousCard, grammarNonAmbiguousCard, "idle");
  setDefaultTitles();
  lastLeft = [];
  lastRight = [];
};

const animateEntry = (element: HTMLElement): void => {
  element.classList.remove("result-pop");
  requestAnimationFrame(() => {
    element.classList.add("result-pop");
  });
};

const setGenerating = (active: boolean): void => {
  generateButton.disabled = active;
  generateButton.textContent = active ? "Generating..." : "Generate Analysis";
  leftmostList.classList.toggle("skeleton", active);
  rightmostList.classList.toggle("skeleton", active);
  extraLeftList.classList.toggle("skeleton", active);
  extraRightList.classList.toggle("skeleton", active);
  leftTreeContainer.classList.toggle("skeleton", active);
  rightTreeContainer.classList.toggle("skeleton", active);
  extraLeftTreeContainer.classList.toggle("skeleton", active);
  extraRightTreeContainer.classList.toggle("skeleton", active);
};

const applyTreeTransform = (scrollEl: HTMLDivElement): void => {
  const v = getViewport(scrollEl);
  const canvas = scrollEl.querySelector(".tree-canvas") as HTMLDivElement | null;
  if (canvas) {
    canvas.style.transform = `translate(${v.offsetX}px, ${v.offsetY}px) scale(${v.scale})`;
  }
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const resetTreeView = (scrollEl: HTMLDivElement): void => {
  const canvas = scrollEl.querySelector(".tree-canvas") as HTMLDivElement | null;
  const v = getViewport(scrollEl);
  if (!canvas) {
    v.scale = 1;
    v.offsetX = 0;
    v.offsetY = 0;
    applyTreeTransform(scrollEl);
    return;
  }

  const canvasWidth = canvas.offsetWidth || 1;
  const canvasHeight = canvas.offsetHeight || 1;
  const containerWidth = Math.max(1, scrollEl.clientWidth - 16);
  const containerHeight = Math.max(1, scrollEl.clientHeight - 16);
  const fitScale = Math.min(1, containerWidth / canvasWidth, containerHeight / canvasHeight);

  v.scale = clamp(fitScale, ZOOM_MIN, 1);
  v.offsetX = Math.max(8, (containerWidth - canvasWidth * v.scale) / 2 + 8);
  v.offsetY = Math.max(8, (containerHeight - canvasHeight * v.scale) / 2 + 8);
  applyTreeTransform(scrollEl);
};

const resetAllTreeViews = (): void => {
  resetTreeView(leftTreeContainer);
  resetTreeView(rightTreeContainer);
  resetTreeView(extraLeftTreeContainer);
  resetTreeView(extraRightTreeContainer);
};

const toTreeText = (root: Element): string =>
  Object.values(
    Array.from(root.querySelectorAll(".tree-node-absolute")).reduce<Record<string, string[]>>((acc, node) => {
      const depth = (node as HTMLElement).dataset.depth ?? "0";
      if (!acc[depth]) {
        acc[depth] = [];
      }
      acc[depth].push(node.textContent ?? "");
      return acc;
    }, {}),
  )
    .map((symbols) => symbols.join(" "))
    .join("\n");

const showToast = (message: string): void => {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastRegion.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 180);
  }, 1800);
};

const copySteps = async (steps: string[]): Promise<void> => {
  if (!steps.length) {
    showToast("Nothing to copy yet.");
    return;
  }
  try {
    await navigator.clipboard.writeText(steps.join("\n"));
    showToast("Copied derivation steps.");
  } catch {
    showToast("Clipboard access failed.");
  }
};

const exportTreeFrom = (scrollEl: HTMLDivElement, filename: string, label: string): void => {
  const treeText = toTreeText(scrollEl).trim();
  if (!treeText) {
    showToast(`No ${label} parse tree to export.`);
    return;
  }
  const blob = new Blob([treeText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`${label} tree exported.`);
};

const applyInitialTheme = (): void => {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = saved ? saved === "dark" : prefersDark;
  document.body.classList.toggle("theme-dark", dark);
};

const toggleTheme = (): void => {
  const isDark = document.body.classList.toggle("theme-dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
};

const attachGlobalPanHandlersOnce = (): void => {
  if (globalPanAttached) {
    return;
  }
  globalPanAttached = true;
  window.addEventListener("mousemove", (event) => {
    if (!panningScrollEl) {
      return;
    }
    const v = getViewport(panningScrollEl);
    v.offsetX = panStartOffsetX + (event.clientX - panAnchorClientX);
    v.offsetY = panStartOffsetY + (event.clientY - panAnchorClientY);
    applyTreeTransform(panningScrollEl);
  });
  window.addEventListener("mouseup", () => {
    if (panningScrollEl) {
      panningScrollEl.classList.remove("is-panning");
      panningScrollEl = null;
    }
  });
};

const initTreeViewport = (scrollEl: HTMLDivElement): void => {
  scrollEl.addEventListener("wheel", (event) => {
    const canvas = scrollEl.querySelector(".tree-canvas") as HTMLDivElement | null;
    if (!canvas) {
      return;
    }
    event.preventDefault();
    const v = getViewport(scrollEl);
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const nextScale = clamp(v.scale + delta, ZOOM_MIN, ZOOM_MAX);
    if (nextScale === v.scale) {
      return;
    }
    const rect = scrollEl.getBoundingClientRect();
    const pivotX = event.clientX - rect.left - v.offsetX;
    const pivotY = event.clientY - rect.top - v.offsetY;
    const ratio = nextScale / v.scale;
    v.offsetX -= pivotX * (ratio - 1);
    v.offsetY -= pivotY * (ratio - 1);
    v.scale = nextScale;
    applyTreeTransform(scrollEl);
  });

  scrollEl.addEventListener("mousedown", (event) => {
    if (!scrollEl.querySelector(".tree-canvas")) {
      return;
    }
    panningScrollEl = scrollEl;
    const v = getViewport(scrollEl);
    panAnchorClientX = event.clientX;
    panAnchorClientY = event.clientY;
    panStartOffsetX = v.offsetX;
    panStartOffsetY = v.offsetY;
    scrollEl.classList.add("is-panning");
  });

  scrollEl.addEventListener("dblclick", () => {
    resetTreeView(scrollEl);
    showToast("Tree view reset.");
  });
};

const run = async (): Promise<void> => {
  setGenerating(true);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  clearOutputs();
  try {
    const grammar = parseGrammar(grammarInput.value, {
      nonTerminalsRaw: nonTerminalInput.value,
      terminalsRaw: terminalInput.value,
      startSymbolRaw: startSymbolInput.value,
    });
    const tokens = tokenizeInput(inputString.value, grammar.terminals);
    const ambiguity = detectAmbiguity(grammar, tokens);

    if (!ambiguity.trees.length) {
      setStatusPair(stringAcceptedCard, stringRejectedCard, "right");
      setStatusPair(grammarAmbiguousCard, grammarNonAmbiguousCard, "idle");
      return;
    }

    const [firstTree, secondTree] = ambiguity.trees;
    const alternativeTree = secondTree ?? firstTree;
    const leftDetailed = leftmostDerivationWithRules(grammar, firstTree);
    const rightDetailed = rightmostDerivationWithRules(grammar, firstTree);
    const extraLeftDetailed = ambiguity.ambiguous
      ? leftmostDerivationWithRules(grammar, alternativeTree)
      : [];
    const extraRightDetailed = ambiguity.ambiguous
      ? rightmostDerivationWithRules(grammar, alternativeTree)
      : [];
    const left = leftDetailed.map((step) => step.sentential);
    const right = rightDetailed.map((step) => step.sentential);

    lastLeft = left;
    lastRight = right;
    lastLeftDetailed = leftDetailed;
    lastRightDetailed = rightDetailed;
    lastExtraLeftDetailed = extraLeftDetailed;
    lastExtraRightDetailed = extraRightDetailed;
    setAmbiguousExtraVisible(ambiguity.ambiguous);
    rerenderDerivationPanels();
    leftTreeSnapshot = firstTree;
    rightTreeSnapshot = firstTree;
    startTreePlayback("left");
    startTreePlayback("right");
    if (ambiguity.ambiguous) {
      renderParseTree(extraLeftTreeContainer, alternativeTree, {
        animateGrowth: false,
        expansionOrder: expansionOrderFromDerivation(extraLeftDetailed),
      });
      renderParseTree(extraRightTreeContainer, alternativeTree, {
        animateGrowth: false,
        expansionOrder: expansionOrderFromDerivation(extraRightDetailed),
      });
    }
    if (ambiguity.ambiguous) {
      setAmbiguousTitles();
    } else {
      setDefaultTitles();
    }
    resetAllTreeViews();
    animateEntry(leftmostList);
    animateEntry(rightmostList);
    animateEntry(leftTreeContainer);
    animateEntry(rightTreeContainer);
    if (ambiguity.ambiguous) {
      animateEntry(extraLeftList);
      animateEntry(extraRightList);
      animateEntry(extraLeftTreeContainer);
      animateEntry(extraRightTreeContainer);
    }

    setStatusPair(stringAcceptedCard, stringRejectedCard, "left");
    setStatusPair(grammarAmbiguousCard, grammarNonAmbiguousCard, ambiguity.ambiguous ? "left" : "right");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    setStatusPair(stringAcceptedCard, stringRejectedCard, "right");
    setStatusPair(grammarAmbiguousCard, grammarNonAmbiguousCard, "idle");
    showToast(`Error: ${message}`);
  } finally {
    setGenerating(false);
  }
};

generateButton.addEventListener("click", () => {
  void run();
});
exampleRunButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.exampleKey as ExampleKey | undefined;
    if (!key) {
      return;
    }
    const example = EXAMPLES[key];
    if (!example) {
      return;
    }
    applyExample(example);
    void run();
  });
});
themeToggleButton.addEventListener("click", toggleTheme);
leftTreeAnimationButton.addEventListener("click", () => {
  leftAnimationEnabled = !leftAnimationEnabled;
  syncTreeAnimationButtons();
  startTreePlayback("left");
});
rightTreeAnimationButton.addEventListener("click", () => {
  rightAnimationEnabled = !rightAnimationEnabled;
  syncTreeAnimationButtons();
  startTreePlayback("right");
});
leftDetailsButton.addEventListener("click", () => {
  showLeftDetails = !showLeftDetails;
  syncDetailsButtons();
  rerenderDerivationPanels();
});
rightDetailsButton.addEventListener("click", () => {
  showRightDetails = !showRightDetails;
  syncDetailsButtons();
  rerenderDerivationPanels();
});
copyLeftButton.addEventListener("click", () => {
  void copySteps(lastLeft);
});
copyRightButton.addEventListener("click", () => {
  void copySteps(lastRight);
});
exportLeftTreeButton.addEventListener("click", () => {
  exportTreeFrom(leftTreeContainer, "parse-tree-leftmost.txt", "leftmost");
});
exportRightTreeButton.addEventListener("click", () => {
  exportTreeFrom(rightTreeContainer, "parse-tree-rightmost.txt", "rightmost");
});
inputString.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    void run();
  }
});

applyInitialTheme();
syncDetailsButtons();
syncTreeAnimationButtons();
attachGlobalPanHandlersOnce();
initTreeViewport(leftTreeContainer);
initTreeViewport(rightTreeContainer);
initTreeViewport(extraLeftTreeContainer);
initTreeViewport(extraRightTreeContainer);
void run();
