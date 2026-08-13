import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  configurable: true,
  value: () => undefined,
});

if (!(HTMLElement.prototype as unknown as { hasPointerCapture?: () => boolean }).hasPointerCapture) {
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    writable: true,
    configurable: true,
    value: () => false,
  });
}

if (!(HTMLElement.prototype as unknown as { setPointerCapture?: () => void }).setPointerCapture) {
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    writable: true,
    configurable: true,
    value: () => undefined,
  });
}

if (!(HTMLElement.prototype as unknown as { releasePointerCapture?: () => void }).releasePointerCapture) {
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    writable: true,
    configurable: true,
    value: () => undefined,
  });
}
