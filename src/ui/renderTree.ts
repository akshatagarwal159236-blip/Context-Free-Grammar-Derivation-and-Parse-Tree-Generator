import type { ParseTreeNode } from "../types/cfg";

type LayoutNode = {
  node: ParseTreeNode;
  depth: number;
  x: number;
  y: number;
  order: number;
};

type RenderTreeOptions = {
  animateGrowth?: boolean;
  stepDelayMs?: number;
  expansionOrder?: number[];
};

export type TreeRenderHandle = {
  skip: () => void;
  done: Promise<void>;
};

const DEFAULT_STEP_DELAY_MS = 680;

const revealElement = (el: Element | undefined, animate: boolean): void => {
  if (!el) {
    return;
  }
  el.classList.remove("is-hidden", "is-sprouting");
  if (animate) {
    el.classList.add("is-sprouting");
  } else {
    el.classList.add("is-visible");
  }
};

export const renderParseTree = (
  container: HTMLDivElement,
  tree: ParseTreeNode,
  options: RenderTreeOptions = {},
): TreeRenderHandle => {
  container.innerHTML = "";
  const animateGrowth = options.animateGrowth ?? true;
  const stepDelayMs = options.stepDelayMs ?? DEFAULT_STEP_DELAY_MS;
  const expansionOrder = options.expansionOrder ?? [];
  const hGap = 90;
  const vGap = 80;
  const leftPad = 40;
  const topPad = 30;

  const layout = new Map<number, LayoutNode>();
  const incomingRule = new Map<number, string>();
  let sequence = 0;
  let maxDepth = 0;
  let leafIndex = 0;

  const layoutTree = (node: ParseTreeNode, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const order = sequence;
    sequence += 1;

    if (!node.children.length) {
      const x = leafIndex * hGap + leftPad;
      leafIndex += 1;
      layout.set(node.id, {
        node,
        depth,
        x,
        y: topPad + depth * vGap,
        order,
      });
      return x;
    }

    const childXs = node.children.map((child) => layoutTree(child, depth + 1));
    const minX = Math.min(...childXs);
    const maxX = Math.max(...childXs);
    const x = (minX + maxX) / 2;
    layout.set(node.id, {
      node,
      depth,
      x,
      y: topPad + depth * vGap,
      order,
    });
    return x;
  };

  layoutTree(tree, 0);
  const width = Math.max(leftPad * 2 + 60, (leafIndex - 1) * hGap + leftPad * 2);
  const height = (maxDepth + 1) * vGap + 40;

  layout.forEach((entry) => {
    if (!entry.node.children.length) {
      return;
    }
    const rhs = entry.node.children.map((child) => child.symbol).join(" ") || "epsilon";
    const rule = `${entry.node.symbol} -> ${rhs}`;
    entry.node.children.forEach((child) => {
      incomingRule.set(child.id, rule);
    });
  });

  const layoutShell = document.createElement("div");
  layoutShell.className = "tree-layout";

  const rulePanel = document.createElement("aside");
  rulePanel.className = "tree-rule-panel";
  const ruleTitle = document.createElement("div");
  ruleTitle.className = "tree-rule-title";
  ruleTitle.textContent = "Current Rule";
  const ruleText = document.createElement("div");
  ruleText.className = "tree-rule-text";
  ruleText.textContent = "Starting from start symbol...";
  rulePanel.appendChild(ruleTitle);
  rulePanel.appendChild(ruleText);

  const canvas = document.createElement("div");
  canvas.className = "tree-canvas";
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "tree-lines");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);

  const linesByChildId = new Map<number, SVGLineElement>();
  layout.forEach((entry) => {
    entry.node.children.forEach((child) => {
      const childEntry = layout.get(child.id);
      if (!childEntry) {
        return;
      }
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", `${entry.x}`);
      line.setAttribute("y1", `${entry.y + 15}`);
      line.setAttribute("x2", `${childEntry.x}`);
      line.setAttribute("y2", `${childEntry.y - 15}`);
      line.setAttribute("class", "tree-line is-hidden");
      linesByChildId.set(child.id, line);
      svg.appendChild(line);
    });
  });
  canvas.appendChild(svg);

  const nodeElsById = new Map<number, HTMLSpanElement>();
  layout.forEach((entry) => {
    const cell = document.createElement("span");
    cell.className = "tree-node tree-node-absolute is-hidden";
    cell.dataset.depth = String(entry.depth);
    cell.textContent = entry.node.symbol || "epsilon";
    cell.style.left = `${entry.x}px`;
    cell.style.top = `${entry.y}px`;

    if (!entry.node.children.length) {
      cell.classList.add("terminal-node");
      const rule = incomingRule.get(entry.node.id);
      if (rule) {
        cell.title = `Introduced by rule: ${rule}`;
      }
    }

    nodeElsById.set(entry.node.id, cell);
    canvas.appendChild(cell);
  });

  layoutShell.appendChild(canvas);
  layoutShell.appendChild(rulePanel);
  container.appendChild(layoutShell);

  const expandableDefault = Array.from(layout.values())
    .filter((entry) => entry.node.children.length > 0)
    .sort((a, b) => a.order - b.order);

  const expandableById = new Map(expandableDefault.map((entry) => [entry.node.id, entry]));
  const usedIds = new Set<number>();
  const expandableFromOrder: LayoutNode[] = [];
  expansionOrder.forEach((id) => {
    if (usedIds.has(id)) {
      return;
    }
    const entry = expandableById.get(id);
    if (!entry) {
      return;
    }
    usedIds.add(id);
    expandableFromOrder.push(entry);
  });
  const expandable = [
    ...expandableFromOrder,
    ...expandableDefault.filter((entry) => !usedIds.has(entry.node.id)),
  ];

  const timeoutIds = new Set<number>();
  let doneResolved = false;
  let skipRequested = false;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const finish = (): void => {
    if (doneResolved) {
      return;
    }
    doneResolved = true;
    timeoutIds.forEach((id) => window.clearTimeout(id));
    timeoutIds.clear();
    resolveDone();
  };

  const clearRuleTextSoon = (): void => {
    const timeoutId = window.setTimeout(() => {
      ruleText.textContent = "";
      timeoutIds.delete(timeoutId);
    }, 500);
    timeoutIds.add(timeoutId);
  };

  const revealWholeTree = (): void => {
    linesByChildId.forEach((line) => revealElement(line, false));
    nodeElsById.forEach((node) => revealElement(node, false));
  };

  const skip = (): void => {
    if (doneResolved) {
      return;
    }
    skipRequested = true;
    revealWholeTree();
    ruleText.textContent = "Animation skipped.";
    clearRuleTextSoon();
    finish();
  };

  revealElement(nodeElsById.get(tree.id), animateGrowth);
  ruleText.textContent = `Start symbol: ${tree.symbol}`;

  if (!animateGrowth) {
    revealWholeTree();
    clearRuleTextSoon();
    finish();
    return { skip, done };
  }

  let index = 0;
  const step = (): void => {
    if (skipRequested) {
      return;
    }
    const current = expandable[index];
    if (!current) {
      ruleText.textContent = "Tree fully expanded.";
      clearRuleTextSoon();
      finish();
      return;
    }
    const rhs = current.node.children.map((child) => child.symbol).join(" ") || "epsilon";
    ruleText.textContent = `${current.node.symbol} -> ${rhs}`;
    current.node.children.forEach((child) => {
      revealElement(linesByChildId.get(child.id), true);
      revealElement(nodeElsById.get(child.id), true);
    });
    index += 1;
    const timeoutId = window.setTimeout(() => {
      timeoutIds.delete(timeoutId);
      step();
    }, stepDelayMs);
    timeoutIds.add(timeoutId);
  };

  const startTimeout = window.setTimeout(() => {
    timeoutIds.delete(startTimeout);
    step();
  }, 280);
  timeoutIds.add(startTimeout);

  return { skip, done };
};
