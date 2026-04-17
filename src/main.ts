import { detectGrammarAmbiguity, detectStringAmbiguity } from "./core/ambiguity";
import {
  leftmostDerivationWithRules,
  rightmostDerivationWithRules,
  type DerivationStep,
} from "./core/derivation";
import { parseGrammar, sententialToString, tokenizeInput } from "./core/grammarParser";
import type { ParseTreeNode } from "./types/cfg";
import { renderSteps } from "./ui/renderDerivations";
import { renderParseTree, type TreeRenderHandle } from "./ui/renderTree";

const grammarInput = document.getElementById("grammarInput") as HTMLTextAreaElement;
const nonTerminalInput = document.getElementById("nonTerminalInput") as HTMLInputElement;
const terminalInput = document.getElementById("terminalInput") as HTMLInputElement;
const startSymbolInput = document.getElementById("startSymbolInput") as HTMLInputElement;
const inputString = document.getElementById("inputString") as HTMLInputElement;
const exampleLoadCards = Array.from(document.querySelectorAll<HTMLElement>(".example-load-card"));
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".hero-nav a[href^='#']"));
const generateButton = document.getElementById("generateButton") as HTMLButtonElement;
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
const ambiguityNote = document.getElementById("ambiguityNote") as HTMLParagraphElement;
const grammarWitnessSection = document.getElementById("grammarWitnessSection") as HTMLElement;
const grammarWitnessString = document.getElementById("grammarWitnessString") as HTMLParagraphElement;
const witnessParse1LeftList = document.getElementById("witnessParse1LeftList") as HTMLOListElement;
const witnessParse2LeftList = document.getElementById("witnessParse2LeftList") as HTMLOListElement;
const witnessParse1RightList = document.getElementById("witnessParse1RightList") as HTMLOListElement;
const witnessParse2RightList = document.getElementById("witnessParse2RightList") as HTMLOListElement;
const witnessParse1LeftTreeContainer = document.getElementById("witnessParse1LeftTreeContainer") as HTMLDivElement;
const witnessParse2LeftTreeContainer = document.getElementById("witnessParse2LeftTreeContainer") as HTMLDivElement;
const witnessParse1RightTreeContainer = document.getElementById("witnessParse1RightTreeContainer") as HTMLDivElement;
const witnessParse2RightTreeContainer = document.getElementById("witnessParse2RightTreeContainer") as HTMLDivElement;
const leftDerivationTitle = document.getElementById("leftDerivationTitle") as HTMLHeadingElement;
const rightDerivationTitle = document.getElementById("rightDerivationTitle") as HTMLHeadingElement;
const leftTreeTitle = document.getElementById("leftTreeTitle") as HTMLHeadingElement;
const rightTreeTitle = document.getElementById("rightTreeTitle") as HTMLHeadingElement;
const leftmostList = document.getElementById("leftmostList") as HTMLOListElement;
const rightmostList = document.getElementById("rightmostList") as HTMLOListElement;
const leftTreeContainer = document.getElementById("leftTreeContainer") as HTMLDivElement;
const rightTreeContainer = document.getElementById("rightTreeContainer") as HTMLDivElement;
const homeSection = document.getElementById("home-section") as HTMLElement | null;
const heroTreeGraphic = document.querySelector(".hero-tree-graphic") as HTMLElement | null;
const toolSection = document.getElementById("tool-section") as HTMLElement | null;
const stringResultSection = document.getElementById("string-result-section") as HTMLElement | null;
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
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.6;
const ZOOM_STEP = 0.12;
const TREE_REPLAY_DELAY_MS = 1000;
const TREE_START_DELAY_MS = 280;
const TREE_STEP_DELAY_MS = 680;
const HERO_ANIMATION_MS = 2200;
const HERO_REPLAY_DELAY_MS = 500;

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
let showingGrammarWitness = false;
let lastWitnessParse1LeftDetailed: DerivationStep[] = [];
let lastWitnessParse2LeftDetailed: DerivationStep[] = [];
let lastWitnessParse1RightDetailed: DerivationStep[] = [];
let lastWitnessParse2RightDetailed: DerivationStep[] = [];
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
let leftDerivationTimeoutIds = new Set<number>();
let rightDerivationTimeoutIds = new Set<number>();
let leftAnimationToken = 0;
let rightAnimationToken = 0;

type AmbiguityPlaybackKey =
  | "extraLeft"
  | "extraRight"
  | "witnessParse1Left"
  | "witnessParse2Left"
  | "witnessParse1Right"
  | "witnessParse2Right";

const AMBIGUITY_PLAYBACK_KEYS: AmbiguityPlaybackKey[] = [
  "extraLeft",
  "extraRight",
  "witnessParse1Left",
  "witnessParse2Left",
  "witnessParse1Right",
  "witnessParse2Right",
];

let ambiguityTreeHandles: Partial<Record<AmbiguityPlaybackKey, TreeRenderHandle>> = {};
let ambiguityReplayTimeoutIds: Partial<Record<AmbiguityPlaybackKey, number>> = {};
const ambiguityDerivationTimeoutIds: Record<AmbiguityPlaybackKey, Set<number>> = {
  extraLeft: new Set<number>(),
  extraRight: new Set<number>(),
  witnessParse1Left: new Set<number>(),
  witnessParse2Left: new Set<number>(),
  witnessParse1Right: new Set<number>(),
  witnessParse2Right: new Set<number>(),
};
const ambiguityAnimationTokens: Record<AmbiguityPlaybackKey, number> = {
  extraLeft: 0,
  extraRight: 0,
  witnessParse1Left: 0,
  witnessParse2Left: 0,
  witnessParse1Right: 0,
  witnessParse2Right: 0,
};
const ambiguityTreeSnapshots: Partial<Record<AmbiguityPlaybackKey, ParseTreeNode>> = {};
const ambiguityDerivationSnapshots: Partial<Record<AmbiguityPlaybackKey, DerivationStep[]>> = {};

type ExampleKey =
  | "ambiguous-expression"
  | "four-nonterminal-input"
  | "ambiguous-single-input"
  | "a-star-b-star"
  | "triple-blocks"
  | "palindrome-even"
  | "balanced-zero-one"
  | "sum-chain";

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
    grammar: "E -> E + T | T\nT -> T * F | F\nF -> e",
    nonTerminals: "E, T, F",
    terminals: "e, +, *",
    startSymbol: "E",
    input: "e + e * e",
  },
  "four-nonterminal-input": {
    grammar: "S -> A B C D\nA -> a A | a\nB -> b B | b\nC -> c C | c\nD -> d D | d",
    nonTerminals: "S, A, B, C, D",
    terminals: "a, b, c, d",
    startSymbol: "S",
    input: "aaaabbbccdd",
  },
  "ambiguous-single-input": {
    grammar: "S -> a S | a",
    nonTerminals: "S",
    terminals: "a",
    startSymbol: "S",
    input: "aaaaa",
  },
  "a-star-b-star": {
    grammar: "S -> A B\nA -> a A | a\nB -> b B | b",
    nonTerminals: "S, A, B",
    terminals: "a, b",
    startSymbol: "S",
    input: "aaabbb",
  },
  "triple-blocks": {
    grammar: "E -> E + E | e",
    nonTerminals: "E",
    terminals: "e, +",
    startSymbol: "E",
    input: "e + e",
  },
  "palindrome-even": {
    grammar: "S -> S S | a",
    nonTerminals: "S",
    terminals: "a",
    startSymbol: "S",
    input: "aa",
  },
  "balanced-zero-one": {
    grammar: "S -> 0 S 1 | 0 1",
    nonTerminals: "S",
    terminals: "0, 1",
    startSymbol: "S",
    input: "000111",
  },
  "sum-chain": {
    grammar: "S -> a S b | epsilon",
    nonTerminals: "S",
    terminals: "a, b",
    startSymbol: "S",
    input: "aaabb",
  },
};

let heroCycleTimeout: number | null = null;

const clearHeroDemoTimers = (): void => {
  if (heroCycleTimeout !== null) {
    window.clearTimeout(heroCycleTimeout);
    heroCycleTimeout = null;
  }
};

const setupHeroTreeDemo = (): void => {
  if (!heroTreeGraphic) {
    return;
  }

  const motionReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (motionReduced) {
    heroTreeGraphic.classList.add("is-playing");
    return;
  }

  const playCycle = (): void => {
    clearHeroDemoTimers();
    heroTreeGraphic.classList.remove("is-playing");
    void heroTreeGraphic.offsetWidth;
    heroTreeGraphic.classList.add("is-playing");
    const cycleDuration = HERO_ANIMATION_MS + HERO_REPLAY_DELAY_MS;
    heroCycleTimeout = window.setTimeout(() => {
      playCycle();
    }, cycleDuration);
  };

  playCycle();
};

const applyExample = (example: ExampleCase): void => {
  grammarInput.value = example.grammar;
  nonTerminalInput.value = example.nonTerminals;
  terminalInput.value = example.terminals;
  startSymbolInput.value = example.startSymbol;
  inputString.value = example.input;
};

const setActiveNavLink = (sectionId: string | null): void => {
  navLinks.forEach((link) => {
    const targetId = link.getAttribute("href")?.slice(1) ?? "";
    link.classList.toggle("is-active", !!sectionId && targetId === sectionId);
  });
};

const initNavHighlight = (): void => {
  if (!navLinks.length) {
    return;
  }

  const targets = navLinks
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1);
      if (!id) {
        return null;
      }
      const section = document.getElementById(id);
      if (!section) {
        return null;
      }
      return { id, section };
    })
    .filter((entry): entry is { id: string; section: HTMLElement } => !!entry);

  if (!targets.length) {
    return;
  }

  const scrollToSection = (id: string): void => {
    const target = targets.find((entry) => entry.id === id);
    if (!target) {
      return;
    }
    const sectionMidpoint = target.section.offsetTop + target.section.offsetHeight / 2;
    const top = Math.max(0, sectionMidpoint - window.innerHeight / 2);
    window.scrollTo({ top, behavior: "smooth" });
  };

  const updateActive = (): void => {
    const marker = window.scrollY + window.innerHeight * 0.35;
    let activeId: string | null = null;
    for (const target of targets) {
      if (marker >= target.section.offsetTop - 98) {
        activeId = target.id;
      }
    }
    setActiveNavLink(activeId);
  };

  window.addEventListener("scroll", updateActive, { passive: true });
  window.addEventListener("resize", updateActive);
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href")?.slice(1) ?? null;
      if (id) {
        event.preventDefault();
        scrollToSection(id);
      }
      setActiveNavLink(id);
    });
  });
  updateActive();
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
    leftDerivationTimeoutIds.forEach((id) => window.clearTimeout(id));
    leftDerivationTimeoutIds.clear();
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
  rightDerivationTimeoutIds.forEach((id) => window.clearTimeout(id));
  rightDerivationTimeoutIds.clear();
};

const clearAllTreePlayback = (): void => {
  clearTreePlayback("left");
  clearTreePlayback("right");
};

const ambiguityListForKey = (key: AmbiguityPlaybackKey): HTMLOListElement => {
  switch (key) {
    case "extraLeft":
      return extraLeftList;
    case "extraRight":
      return extraRightList;
    case "witnessParse1Left":
      return witnessParse1LeftList;
    case "witnessParse2Left":
      return witnessParse2LeftList;
    case "witnessParse1Right":
      return witnessParse1RightList;
    case "witnessParse2Right":
      return witnessParse2RightList;
  }
};

const ambiguityTreeContainerForKey = (key: AmbiguityPlaybackKey): HTMLDivElement => {
  switch (key) {
    case "extraLeft":
      return extraLeftTreeContainer;
    case "extraRight":
      return extraRightTreeContainer;
    case "witnessParse1Left":
      return witnessParse1LeftTreeContainer;
    case "witnessParse2Left":
      return witnessParse2LeftTreeContainer;
    case "witnessParse1Right":
      return witnessParse1RightTreeContainer;
    case "witnessParse2Right":
      return witnessParse2RightTreeContainer;
  }
};

const ambiguityShowDetailsForKey = (key: AmbiguityPlaybackKey): boolean =>
  key.endsWith("Left") ? showLeftDetails : showRightDetails;

const clearAmbiguityPlayback = (key: AmbiguityPlaybackKey): void => {
  ambiguityAnimationTokens[key] += 1;
  const replayId = ambiguityReplayTimeoutIds[key];
  if (replayId !== undefined) {
    window.clearTimeout(replayId);
    delete ambiguityReplayTimeoutIds[key];
  }
  const handle = ambiguityTreeHandles[key];
  if (handle) {
    handle.skip();
    delete ambiguityTreeHandles[key];
  }
  const timeoutIds = ambiguityDerivationTimeoutIds[key];
  timeoutIds.forEach((id) => window.clearTimeout(id));
  timeoutIds.clear();
};

const clearAllAmbiguityPlayback = (): void => {
  AMBIGUITY_PLAYBACK_KEYS.forEach((key) => clearAmbiguityPlayback(key));
};

const startAmbiguityDerivationPlayback = (key: AmbiguityPlaybackKey, steps: DerivationStep[], token: number): void => {
  const list = ambiguityListForKey(key);
  const timeoutIds = ambiguityDerivationTimeoutIds[key];
  timeoutIds.forEach((id) => window.clearTimeout(id));
  timeoutIds.clear();

  if (!steps.length) {
    renderSteps(list, [], ambiguityShowDetailsForKey(key));
    return;
  }

  renderSteps(list, [steps[0]], ambiguityShowDetailsForKey(key));

  for (let index = 1; index < steps.length; index += 1) {
    const timeoutId = window.setTimeout(() => {
      timeoutIds.delete(timeoutId);
      if (token !== ambiguityAnimationTokens[key]) {
        return;
      }
      renderSteps(list, steps.slice(0, index + 1), ambiguityShowDetailsForKey(key));
    }, TREE_START_DELAY_MS + (index - 1) * TREE_STEP_DELAY_MS);
    timeoutIds.add(timeoutId);
  }
};

const startAmbiguityPlayback = (key: AmbiguityPlaybackKey): void => {
  const tree = ambiguityTreeSnapshots[key];
  const steps = ambiguityDerivationSnapshots[key] ?? [];
  const container = ambiguityTreeContainerForKey(key);
  const list = ambiguityListForKey(key);

  if (!tree) {
    renderSteps(list, [], ambiguityShowDetailsForKey(key));
    container.innerHTML = "";
    return;
  }

  clearAmbiguityPlayback(key);
  const token = ambiguityAnimationTokens[key];
  startAmbiguityDerivationPlayback(key, steps, token);
  const handle = renderParseTree(container, tree, {
    animateGrowth: true,
    expansionOrder: expansionOrderFromDerivation(steps),
  });
  requestAnimationFrame(() => {
    resetTreeView(container);
  });
  ambiguityTreeHandles[key] = handle;

  void handle.done.then(() => {
    if (token !== ambiguityAnimationTokens[key]) {
      return;
    }
    delete ambiguityTreeHandles[key];
    renderSteps(list, steps, ambiguityShowDetailsForKey(key));
    resetTreeView(container);
    const timeoutId = window.setTimeout(() => {
      if (token !== ambiguityAnimationTokens[key]) {
        return;
      }
      startAmbiguityPlayback(key);
    }, TREE_REPLAY_DELAY_MS);
    ambiguityReplayTimeoutIds[key] = timeoutId;
  });
};

const startDerivationStepPlayback = (
  side: "left" | "right",
  steps: DerivationStep[],
  animate: boolean,
  token: number,
): void => {
  const isLeft = side === "left";
  const list = isLeft ? leftmostList : rightmostList;
  const showDetails = isLeft ? showLeftDetails : showRightDetails;
  const timeoutIds = isLeft ? leftDerivationTimeoutIds : rightDerivationTimeoutIds;

  timeoutIds.forEach((id) => window.clearTimeout(id));
  timeoutIds.clear();

  if (!steps.length) {
    renderSteps(list, [], showDetails);
    return;
  }
  if (!animate) {
    renderSteps(list, steps, showDetails);
    return;
  }

  renderSteps(list, [steps[0]], showDetails);
  for (let index = 1; index < steps.length; index += 1) {
    const timeoutId = window.setTimeout(() => {
      timeoutIds.delete(timeoutId);
      const activeToken = isLeft ? leftAnimationToken : rightAnimationToken;
      if (token !== activeToken) {
        return;
      }
      renderSteps(list, steps.slice(0, index + 1), showDetails);
    }, TREE_START_DELAY_MS + (index - 1) * TREE_STEP_DELAY_MS);
    timeoutIds.add(timeoutId);
  }
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
  startDerivationStepPlayback(side, derivationSteps, enabled, token);
  const handle = renderParseTree(container, tree, {
    animateGrowth: enabled,
    expansionOrder: expansionOrderFromDerivation(derivationSteps),
  });
  // Keep every replay fitted in-view so subsequent cycles do not clip outside the panel.
  requestAnimationFrame(() => {
    resetTreeView(container);
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
    renderSteps(
      isLeft ? leftmostList : rightmostList,
      derivationSteps,
      isLeft ? showLeftDetails : showRightDetails,
    );
    resetTreeView(container);
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

const setGrammarWitnessVisible = (visible: boolean): void => {
  showingGrammarWitness = visible;
  grammarWitnessSection.classList.toggle("is-hidden", !visible);
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

  if (showingGrammarWitness) {
    renderSteps(witnessParse1LeftList, lastWitnessParse1LeftDetailed, showLeftDetails);
    renderSteps(witnessParse2LeftList, lastWitnessParse2LeftDetailed, showLeftDetails);
    renderSteps(witnessParse1RightList, lastWitnessParse1RightDetailed, showRightDetails);
    renderSteps(witnessParse2RightList, lastWitnessParse2RightDetailed, showRightDetails);
  } else {
    renderSteps(witnessParse1LeftList, []);
    renderSteps(witnessParse2LeftList, []);
    renderSteps(witnessParse1RightList, []);
    renderSteps(witnessParse2RightList, []);
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
  clearAllAmbiguityPlayback();
  leftTreeSnapshot = null;
  rightTreeSnapshot = null;
  lastLeftDetailed = [];
  lastRightDetailed = [];
  lastExtraLeftDetailed = [];
  lastExtraRightDetailed = [];
  lastWitnessParse1LeftDetailed = [];
  lastWitnessParse2LeftDetailed = [];
  lastWitnessParse1RightDetailed = [];
  lastWitnessParse2RightDetailed = [];
  setAmbiguousExtraVisible(false);
  setGrammarWitnessVisible(false);
  rerenderDerivationPanels();
  leftTreeContainer.innerHTML = "";
  rightTreeContainer.innerHTML = "";
  extraLeftTreeContainer.innerHTML = "";
  extraRightTreeContainer.innerHTML = "";
  witnessParse1LeftTreeContainer.innerHTML = "";
  witnessParse2LeftTreeContainer.innerHTML = "";
  witnessParse1RightTreeContainer.innerHTML = "";
  witnessParse2RightTreeContainer.innerHTML = "";
  setStatusPair(stringAcceptedCard, stringRejectedCard, "idle");
  setStatusPair(grammarAmbiguousCard, grammarNonAmbiguousCard, "idle");
  ambiguityNote.textContent = "";
  grammarWitnessString.textContent = "";
  AMBIGUITY_PLAYBACK_KEYS.forEach((key) => {
    delete ambiguityTreeSnapshots[key];
    delete ambiguityDerivationSnapshots[key];
  });
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
  witnessParse1LeftList.classList.toggle("skeleton", active && showingGrammarWitness);
  witnessParse2LeftList.classList.toggle("skeleton", active && showingGrammarWitness);
  witnessParse1RightList.classList.toggle("skeleton", active && showingGrammarWitness);
  witnessParse2RightList.classList.toggle("skeleton", active && showingGrammarWitness);
  leftTreeContainer.classList.toggle("skeleton", active);
  rightTreeContainer.classList.toggle("skeleton", active);
  extraLeftTreeContainer.classList.toggle("skeleton", active);
  extraRightTreeContainer.classList.toggle("skeleton", active);
  witnessParse1LeftTreeContainer.classList.toggle("skeleton", active && showingGrammarWitness);
  witnessParse2LeftTreeContainer.classList.toggle("skeleton", active && showingGrammarWitness);
  witnessParse1RightTreeContainer.classList.toggle("skeleton", active && showingGrammarWitness);
  witnessParse2RightTreeContainer.classList.toggle("skeleton", active && showingGrammarWitness);
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
  resetTreeView(witnessParse1LeftTreeContainer);
  resetTreeView(witnessParse2LeftTreeContainer);
  resetTreeView(witnessParse1RightTreeContainer);
  resetTreeView(witnessParse2RightTreeContainer);
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
    const grammarAmbiguity = detectGrammarAmbiguity(grammar);
    const inputAmbiguity = detectStringAmbiguity(grammar, tokens);

    const inputAccepted = inputAmbiguity.trees.length > 0;
    const treesForDisplay = inputAmbiguity.trees;
    const ambiguousForDisplay = inputAmbiguity.ambiguous;

    const hasWitness =
      grammarAmbiguity.ambiguous &&
      !!grammarAmbiguity.witnessTokens &&
      !!grammarAmbiguity.witnessTrees &&
      grammarAmbiguity.witnessTrees.length > 1;

    if (grammarAmbiguity.ambiguous && grammarAmbiguity.witnessTokens) {
      const witness = sententialToString(grammarAmbiguity.witnessTokens);
      ambiguityNote.textContent = `Ambiguous grammar witness string: ${witness}.`;
      grammarWitnessString.textContent = `Witness string with multiple parses: ${witness}`;
    } else {
      ambiguityNote.textContent = grammarAmbiguity.note;
      grammarWitnessString.textContent = "";
    }

    if (hasWitness) {
      const [witnessTreeA, witnessTreeB] = grammarAmbiguity.witnessTrees!;
      lastWitnessParse1LeftDetailed = leftmostDerivationWithRules(grammar, witnessTreeA);
      lastWitnessParse2LeftDetailed = leftmostDerivationWithRules(grammar, witnessTreeB);
      lastWitnessParse1RightDetailed = rightmostDerivationWithRules(grammar, witnessTreeA);
      lastWitnessParse2RightDetailed = rightmostDerivationWithRules(grammar, witnessTreeB);
      ambiguityTreeSnapshots.witnessParse1Left = witnessTreeA;
      ambiguityTreeSnapshots.witnessParse2Left = witnessTreeB;
      ambiguityTreeSnapshots.witnessParse1Right = witnessTreeA;
      ambiguityTreeSnapshots.witnessParse2Right = witnessTreeB;
      ambiguityDerivationSnapshots.witnessParse1Left = lastWitnessParse1LeftDetailed;
      ambiguityDerivationSnapshots.witnessParse2Left = lastWitnessParse2LeftDetailed;
      ambiguityDerivationSnapshots.witnessParse1Right = lastWitnessParse1RightDetailed;
      ambiguityDerivationSnapshots.witnessParse2Right = lastWitnessParse2RightDetailed;
      setGrammarWitnessVisible(true);
      rerenderDerivationPanels();
      startAmbiguityPlayback("witnessParse1Left");
      startAmbiguityPlayback("witnessParse2Left");
      startAmbiguityPlayback("witnessParse1Right");
      startAmbiguityPlayback("witnessParse2Right");
    } else {
      clearAmbiguityPlayback("witnessParse1Left");
      clearAmbiguityPlayback("witnessParse2Left");
      clearAmbiguityPlayback("witnessParse1Right");
      clearAmbiguityPlayback("witnessParse2Right");
      delete ambiguityTreeSnapshots.witnessParse1Left;
      delete ambiguityTreeSnapshots.witnessParse2Left;
      delete ambiguityTreeSnapshots.witnessParse1Right;
      delete ambiguityTreeSnapshots.witnessParse2Right;
      delete ambiguityDerivationSnapshots.witnessParse1Left;
      delete ambiguityDerivationSnapshots.witnessParse2Left;
      delete ambiguityDerivationSnapshots.witnessParse1Right;
      delete ambiguityDerivationSnapshots.witnessParse2Right;
      setGrammarWitnessVisible(false);
      rerenderDerivationPanels();
    }

    if (!treesForDisplay.length) {
      setStatusPair(stringAcceptedCard, stringRejectedCard, "right");
      setStatusPair(grammarAmbiguousCard, grammarNonAmbiguousCard, grammarAmbiguity.ambiguous ? "left" : "right");
      resetAllTreeViews();
      if (hasWitness) {
        animateEntry(grammarWitnessSection);
      }
      return;
    }

    const [firstTree, secondTree] = treesForDisplay;
    const alternativeTree = secondTree ?? firstTree;
    const leftDetailed = leftmostDerivationWithRules(grammar, firstTree);
    const rightDetailed = rightmostDerivationWithRules(grammar, firstTree);
    const extraLeftDetailed = ambiguousForDisplay
      ? leftmostDerivationWithRules(grammar, alternativeTree)
      : [];
    const extraRightDetailed = ambiguousForDisplay
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
    setAmbiguousExtraVisible(ambiguousForDisplay);
    rerenderDerivationPanels();
    leftTreeSnapshot = firstTree;
    rightTreeSnapshot = firstTree;
    startTreePlayback("left");
    startTreePlayback("right");
    if (ambiguousForDisplay) {
      ambiguityTreeSnapshots.extraLeft = alternativeTree;
      ambiguityTreeSnapshots.extraRight = alternativeTree;
      ambiguityDerivationSnapshots.extraLeft = extraLeftDetailed;
      ambiguityDerivationSnapshots.extraRight = extraRightDetailed;
      startAmbiguityPlayback("extraLeft");
      startAmbiguityPlayback("extraRight");
    } else {
      clearAmbiguityPlayback("extraLeft");
      clearAmbiguityPlayback("extraRight");
      delete ambiguityTreeSnapshots.extraLeft;
      delete ambiguityTreeSnapshots.extraRight;
      delete ambiguityDerivationSnapshots.extraLeft;
      delete ambiguityDerivationSnapshots.extraRight;
    }
    if (ambiguousForDisplay) {
      setAmbiguousTitles();
    } else {
      setDefaultTitles();
    }
    resetAllTreeViews();
    animateEntry(leftmostList);
    animateEntry(rightmostList);
    animateEntry(leftTreeContainer);
    animateEntry(rightTreeContainer);
    if (ambiguousForDisplay) {
      animateEntry(extraLeftList);
      animateEntry(extraRightList);
      animateEntry(extraLeftTreeContainer);
      animateEntry(extraRightTreeContainer);
    }
    if (hasWitness) {
      animateEntry(grammarWitnessSection);
      animateEntry(witnessParse1LeftList);
      animateEntry(witnessParse2LeftList);
      animateEntry(witnessParse1RightList);
      animateEntry(witnessParse2RightList);
      animateEntry(witnessParse1LeftTreeContainer);
      animateEntry(witnessParse2LeftTreeContainer);
      animateEntry(witnessParse1RightTreeContainer);
      animateEntry(witnessParse2RightTreeContainer);
    }

    setStatusPair(stringAcceptedCard, stringRejectedCard, inputAccepted ? "left" : "right");
    setStatusPair(grammarAmbiguousCard, grammarNonAmbiguousCard, grammarAmbiguity.ambiguous ? "left" : "right");
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
  void run().then(() => {
    if (!stringResultSection) {
      return;
    }
    const navClearance = 104;
    const top = Math.max(0, stringResultSection.offsetTop - navClearance);
    window.scrollTo({ top, behavior: "smooth" });
  });
});
exampleLoadCards.forEach((card) => {
  const loadExample = (): void => {
    const key = card.dataset.exampleKey as ExampleKey | undefined;
    if (!key) {
      return;
    }
    const example = EXAMPLES[key];
    if (!example) {
      return;
    }
    applyExample(example);
    toolSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  card.addEventListener("click", () => {
    loadExample();
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      loadExample();
    }
  });
});
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

syncDetailsButtons();
syncTreeAnimationButtons();
attachGlobalPanHandlersOnce();
initTreeViewport(leftTreeContainer);
initTreeViewport(rightTreeContainer);
initTreeViewport(extraLeftTreeContainer);
initTreeViewport(extraRightTreeContainer);
initTreeViewport(witnessParse1LeftTreeContainer);
initTreeViewport(witnessParse2LeftTreeContainer);
initTreeViewport(witnessParse1RightTreeContainer);
initTreeViewport(witnessParse2RightTreeContainer);
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
const forceHomeOnLoad = (): void => {
  const homeHash = "#home-section";
  const cleanUrl = `${window.location.pathname}${window.location.search}${homeHash}`;
  if (window.location.hash !== homeHash) {
    history.replaceState(null, "", cleanUrl);
  }
  const jumpHome = (): void => {
    homeSection?.scrollIntoView({ block: "start", behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };
  jumpHome();
  requestAnimationFrame(jumpHome);
};
forceHomeOnLoad();
window.addEventListener("load", forceHomeOnLoad);
setupHeroTreeDemo();
initNavHighlight();
