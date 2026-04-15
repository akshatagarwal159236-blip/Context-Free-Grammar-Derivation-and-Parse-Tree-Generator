import type { DerivationStep } from "../core/derivation";

type RenderableStep = string | DerivationStep;

const normalizeStep = (step: RenderableStep): DerivationStep =>
  typeof step === "string" ? { sentential: step } : step;

export const renderSteps = (
  container: HTMLOListElement,
  steps: RenderableStep[],
  showRuleDetails = false,
): void => {
  container.innerHTML = "";
  steps.forEach((step) => {
    const parsed = normalizeStep(step);
    const item = document.createElement("li");
    const sententialLine = document.createElement("div");
    sententialLine.className = "step-sentential";
    sententialLine.textContent = parsed.sentential;
    item.appendChild(sententialLine);

    if (showRuleDetails && parsed.rule) {
      const ruleLine = document.createElement("div");
      ruleLine.className = "step-rule";
      ruleLine.textContent = parsed.rule;
      item.appendChild(ruleLine);
    }
    container.appendChild(item);
  });
};
