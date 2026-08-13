import { useEffect } from "react";

const DECRYPT_CHARS = "01BALARYARCUSDC#$%";
const DECRYPT_DURATION_MS = 520;

const BUTTON_SELECTOR = [
  "button:not(:disabled):not(.rs-card):not(.filter-tab)",
  "a.btn",
  ".decrypt-hover-btn",
  ".welcome-role-card",
  ".badge",
  ".wpicker-item:not(:disabled)",
  ".wpicker-close-btn",
  ".welcome-close",
  ".rs-card-cta",
  ".rs-back",
  ".lp-nav-btn",
  ".lp-btn-p",
  ".lp-btn-g",
  ".lp-cta-main",
  ".lp-cta-ghost-btn",
].join(",");

type ActiveAnimation = {
  element: HTMLElement;
  frameId: number;
  nodes: Text[];
  originals: string[];
};

function isTextScrambleChar(char: string) {
  return /[a-z0-9]/i.test(char);
}

function scrambleText(value: string, progress: number, salt: number) {
  const chars = Array.from(value);
  const revealCount = Math.floor(chars.length * progress);
  const frame = Math.floor(progress * DECRYPT_CHARS.length * 2.2);

  return chars
    .map((char, index) => {
      if (!isTextScrambleChar(char) || index < revealCount) return char;
      return DECRYPT_CHARS[(index + salt + frame) % DECRYPT_CHARS.length];
    })
    .join("");
}

function resolveButtonTarget(rawTarget: EventTarget | null) {
  if (!(rawTarget instanceof Element)) return null;

  const roleCard = rawTarget.closest(".rs-card");
  if (roleCard) {
    return roleCard.querySelector<HTMLElement>(".rs-card-cta");
  }

  const target = rawTarget.closest<HTMLElement>(BUTTON_SELECTOR);
  if (!target || target.getAttribute("aria-disabled") === "true") return null;
  if (target.closest(".create-payroll-form")) return null;
  if (target.closest(".sidebar-nav-item:not(.sidebar-disconnect-btn)")) {
    return null;
  }

  return target;
}

function collectTextNodes(element: HTMLElement) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.textContent ?? "";
        const parent = node.parentElement;

        if (!text.trim() || !parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("svg, style, script, [data-no-decrypt-text]")) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  return nodes;
}

export function DecryptHoverText() {
  useEffect(() => {
    const activeAnimations = new Map<HTMLElement, ActiveAnimation>();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function restore(animation: ActiveAnimation) {
      cancelAnimationFrame(animation.frameId);
      animation.nodes.forEach((node, index) => {
        if (node.isConnected) node.textContent = animation.originals[index];
      });
      activeAnimations.delete(animation.element);
    }

    function start(element: HTMLElement) {
      if (reduceMotion.matches || !element.isConnected) return;

      const currentAnimation = activeAnimations.get(element);
      if (currentAnimation) restore(currentAnimation);

      const nodes = collectTextNodes(element);
      if (nodes.length === 0) return;

      const originals = nodes.map((node) => node.textContent ?? "");
      const startTime = performance.now();
      const salt = originals.join("").length + element.className.length;

      const animation: ActiveAnimation = {
        element,
        frameId: 0,
        nodes,
        originals,
      };

      const tick = (now: number) => {
        if (!element.isConnected) {
          activeAnimations.delete(element);
          return;
        }

        const linearProgress = Math.min(
          (now - startTime) / DECRYPT_DURATION_MS,
          1
        );
        const progress = 1 - Math.pow(1 - linearProgress, 3);

        nodes.forEach((node, index) => {
          if (node.isConnected) {
            node.textContent = scrambleText(originals[index], progress, salt + index * 7);
          }
        });

        if (linearProgress < 1) {
          animation.frameId = requestAnimationFrame(tick);
          return;
        }

        restore(animation);
      };

      activeAnimations.set(element, animation);
      animation.frameId = requestAnimationFrame(tick);
    }

    function handlePointerOver(event: PointerEvent) {
      const element = resolveButtonTarget(event.target);
      if (!element) return;

      const related = event.relatedTarget;
      if (related instanceof Node && element.contains(related)) return;

      start(element);
    }

    function handleFocusIn(event: FocusEvent) {
      const element = resolveButtonTarget(event.target);
      if (element) start(element);
    }

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("focusin", handleFocusIn);
      activeAnimations.forEach(restore);
      activeAnimations.clear();
    };
  }, []);

  return null;
}
