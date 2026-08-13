import React from "react";
import { TourProvider, useTour, type ProviderProps, type StepType } from "@reactour/tour";
import { useLocation } from "react-router-dom";
import { useWallet } from "../../lib/wallet";

type DashboardTourRole = "hr" | "finance" | "employee";

const TOUR_VERSION = "v2";

function TourContent({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-tour-content">
      <div className="dashboard-tour-eyebrow">{eyebrow}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function stepsFor(role: DashboardTourRole): StepType[] {
  const includeSidebar = !isMobileViewport();

  if (role === "hr") {
    return [
      ...(includeSidebar
        ? [
            {
              selector: '[data-tour="nav-hr"]',
              position: "right" as const,
              content: (
                <TourContent eyebrow="Navigation" title="HR payroll">
                  Upload payroll rows, validate CSV data, and prepare backend-built payroll packages.
                </TourContent>
              ),
            },
          ]
        : []),
    ];
  }

  if (role === "finance") {
    return [
      ...(includeSidebar
        ? [
            {
              selector: '[data-tour="nav-finance"]',
              position: "right" as const,
              content: (
                <TourContent eyebrow="Navigation" title="Finance queue">
                  Review funding-ready payroll and submit backend-prepared Coston2 USD₮0 funding actions.
                </TourContent>
              ),
            },
          ]
        : []),
    ];
  }

  return [
    ...(includeSidebar
      ? [
          {
            selector: '[data-tour="nav-employee"]',
            position: "right" as const,
            content: (
              <TourContent eyebrow="Navigation" title="Private withdrawals">
                Prepare, authorize, and track private Coston2 USD₮0 payroll withdrawals from the connected wallet.
              </TourContent>
            ),
          },
        ]
      : []),
  ];
}

function tourRoleForPath(pathname: string): DashboardTourRole | null {
  if (pathname === "/hr") return "hr";
  if (pathname === "/finance") return "finance";
  if (pathname === "/employee/claims") return "employee";
  return null;
}

function completionKey(role: DashboardTourRole, wallet: string) {
  return `balary-tour:${role}:${wallet.toLowerCase()}:${TOUR_VERSION}`;
}

function isCompleted(role: DashboardTourRole, wallet: string) {
  return localStorage.getItem(completionKey(role, wallet)) === "done";
}

function markCompleted(role: DashboardTourRole, wallet: string) {
  localStorage.setItem(completionKey(role, wallet), "done");
}

function allTargetsExist(steps: StepType[]) {
  return steps.every((step) => {
    if (typeof step.selector !== "string") return true;
    return Boolean(document.querySelector(step.selector));
  });
}

function DashboardTourController() {
  const location = useLocation();
  const { address } = useWallet();
  const { isOpen, setCurrentStep, setIsOpen, setSteps } = useTour();
  const openSessionRef = React.useRef<{
    role: DashboardTourRole;
    wallet: string;
  } | null>(null);
  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }

    if (wasOpenRef.current && openSessionRef.current) {
      markCompleted(openSessionRef.current.role, openSessionRef.current.wallet);
      openSessionRef.current = null;
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  React.useEffect(() => {
    const role = tourRoleForPath(location.pathname);
    if (!role || !address || isOpen || !setSteps) return;
    if (isCompleted(role, address)) return;

    const steps = stepsFor(role);
    if (steps.length === 0) return;
    let cancelled = false;
    let attempts = 0;
    let retryId: number | undefined;

    const startWhenReady = () => {
      if (cancelled) return;

      if (allTargetsExist(steps)) {
        setSteps(steps);
        setCurrentStep(0);
        openSessionRef.current = { role, wallet: address };
        setIsOpen(true);
        return;
      }

      attempts += 1;
      if (attempts < 24) {
        retryId = window.setTimeout(startWhenReady, 125);
      }
    };

    retryId = window.setTimeout(startWhenReady, 350);

    return () => {
      cancelled = true;
      if (retryId) window.clearTimeout(retryId);
    };
  }, [location.pathname, address, isOpen, setCurrentStep, setIsOpen, setSteps]);

  return null;
}

const tourStyles: ProviderProps["styles"] = {
  popover: (base) => ({
    ...base,
    "--reactour-accent": "var(--z-accent)",
    background: "#15191a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    color: "var(--z-text)",
    padding: "1rem",
    boxShadow: "0 20px 70px rgba(0,0,0,0.55)",
    maxWidth: "340px",
  }),
  maskWrapper: (base) => ({
    ...base,
    color: "rgba(0,0,0,0.72)",
  }),
  maskArea: (base) => ({
    ...base,
    rx: 8,
  }),
  badge: (base) => ({
    ...base,
    background: "var(--z-accent)",
    color: "#050505",
    fontFamily: "var(--z-mono)",
    fontSize: "0.62rem",
  }),
  controls: (base) => ({
    ...base,
    marginTop: "0.9rem",
  }),
  button: (base, state) => ({
    ...base,
    background: state?.kind === "next" ? "var(--z-accent)" : "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    color: state?.kind === "next" ? "#050505" : "rgba(255,255,255,0.82)",
    fontFamily: "var(--z-mono)",
    fontSize: "0.62rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  }),
  dot: (base, state) => ({
    ...base,
    background: state?.current ? "var(--z-accent)" : "rgba(255,255,255,0.22)",
  }),
  close: (base) => ({
    ...base,
    color: "rgba(255,255,255,0.52)",
  }),
};

export function DashboardTourProvider({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider
      steps={[]}
      styles={tourStyles}
      padding={{ mask: 12, wrapper: 8 }}
      scrollSmooth
      showBadge
      showCloseButton
      showDots
      showNavigation
      showPrevNextButtons
      disableInteraction={false}
      disableDotsNavigation={false}
      accessibilityOptions={{
        closeButtonAriaLabel: "Close dashboard tour",
        showNavigationScreenReaders: true,
      }}
    >
      {children}
      <DashboardTourController />
    </TourProvider>
  );
}
