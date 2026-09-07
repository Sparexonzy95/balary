import { type CSSProperties, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Wallet as WalletIcon, X } from "lucide-react";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useWallet } from "../lib/wallet";

type WelcomeStepId = "institution" | "hr" | "employee";
type WelcomeCarouselStyle = CSSProperties & {
  "--welcome-carousel-duration": string;
};

const WELCOME_CAROUSEL_DELAY_MS = 5000;
const WELCOME_DECRYPT_DURATION_MS = 820;
const DECRYPT_CHARS = "01BALARYARCUSDC#$%";

const WELCOME_STEPS: Array<{
  id: WelcomeStepId;
  number: string;
  title: string;
  body: string;
}> = [
  {
    id: "institution",
    number: "01",
    title: "Institution ready",
    body: "Register an institution, set treasury wallets, and assign payroll roles from one workspace.",
  },
  {
    id: "hr",
    number: "02",
    title: "For HR teams",
    body: "Create payroll runs, upload employee rows, validate CSV data, and prepare backend packages.",
  },
  {
    id: "employee",
    number: "03",
    title: "For employees",
    body: "View available claims and receive Coston2 USD₮0 payouts from the connected wallet.",
  },
];

function decryptText(value: string, progress: number, salt: number) {
  const revealCount = Math.floor(value.length * progress);
  const noiseFrame = Math.floor(progress * DECRYPT_CHARS.length * 1.8);

  return Array.from(value)
    .map((char, index) => {
      if (!/[a-z0-9]/i.test(char) || index < revealCount) return char;
      return DECRYPT_CHARS[(index + salt * 5 + noiseFrame) % DECRYPT_CHARS.length];
    })
    .join("");
}

function WelcomeStepIllustration({ id }: { id: WelcomeStepId }) {
  if (id === "hr") {
    return (
      <div className="welcome-step-illustration" key={id} aria-hidden="true">
        <svg viewBox="0 0 180 128" fill="none" focusable="false">
          <rect className="welcome-figure-panel" x="30" y="25" width="120" height="78" rx="10" />
          <path className="welcome-figure-line" d="M43 48h94" />
          <rect className="welcome-figure-soft" x="48" y="36" width="22" height="8" rx="4" />
          <path className="welcome-figure-line" d="M51 64h38M51 78h30M51 92h44" />
          <path className="welcome-figure-line" d="M106 64h23M106 78h28M106 92h18" />
          <rect className="welcome-figure-accent" x="106" y="34" width="26" height="20" rx="5" />
          <path className="welcome-figure-dark" d="M113 34v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3" />
          <path className="welcome-figure-soft-line" d="M44 109h92" />
        </svg>
      </div>
    );
  }

  if (id === "employee") {
    return (
      <div className="welcome-step-illustration" key={id} aria-hidden="true">
        <svg viewBox="0 0 180 128" fill="none" focusable="false">
          <rect className="welcome-figure-panel" x="38" y="28" width="104" height="72" rx="12" />
          <circle className="welcome-figure-soft" cx="73" cy="60" r="15" />
          <path className="welcome-figure-line" d="M56 86c4-12 30-12 34 0" />
          <rect className="welcome-figure-accent" x="97" y="48" width="31" height="23" rx="7" />
          <path className="welcome-figure-dark" d="m106 60 6 6 10-13" />
          <path className="welcome-figure-line" d="M99 84h28" />
          <path className="welcome-figure-soft-line" d="M52 107h76" />
          <path className="welcome-figure-soft-line" d="M64 20h52" />
        </svg>
      </div>
    );
  }

  return (
    <div className="welcome-step-illustration" key={id} aria-hidden="true">
      <svg viewBox="0 0 180 128" fill="none" focusable="false">
        <rect className="welcome-figure-panel" x="38" y="24" width="104" height="78" rx="11" />
        <path className="welcome-figure-line" d="M55 48h70M55 64h34M55 80h52" />
        <rect className="welcome-figure-soft" x="94" y="56" width="33" height="29" rx="7" />
        <path className="welcome-figure-dark" d="M102 56v-5a9 9 0 0 1 18 0v5" />
        <path className="welcome-figure-dark" d="M111 68v6" />
        <circle className="welcome-figure-dark-fill" cx="111" cy="66" r="2.6" />
        <path className="welcome-figure-soft-line" d="M44 110h92" />
        <path className="welcome-figure-soft-line" d="M62 18h56" />
      </svg>
    </div>
  );
}

export function WelcomePage() {
  const wallet = useWallet();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const address = wallet.address;
  const shortWallet = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "";
  const step = WELCOME_STEPS[activeStep];
  const [displayStep, setDisplayStep] = useState({
    number: step.number,
    title: step.title,
    body: step.body,
  });
  const carouselStyle: WelcomeCarouselStyle = {
    "--welcome-carousel-duration": `${WELCOME_CAROUSEL_DELAY_MS}ms`,
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((current) => (current + 1) % WELCOME_STEPS.length);
    }, WELCOME_CAROUSEL_DELAY_MS);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayStep({
        number: step.number,
        title: step.title,
        body: step.body,
      });
      return;
    }

    let animationFrame = 0;
    const start = performance.now();

    const renderFrame = (now: number) => {
      const elapsed = now - start;
      const linearProgress = Math.min(elapsed / WELCOME_DECRYPT_DURATION_MS, 1);
      const easedProgress = 1 - Math.pow(1 - linearProgress, 3);

      setDisplayStep({
        number: decryptText(step.number, Math.min(easedProgress * 1.8, 1), activeStep),
        title: decryptText(step.title, easedProgress, activeStep),
        body: decryptText(step.body, Math.min(easedProgress * 1.08, 1), activeStep),
      });

      if (linearProgress < 1) {
        animationFrame = requestAnimationFrame(renderFrame);
      }
    };

    setDisplayStep({
      number: decryptText(step.number, 0, activeStep),
      title: decryptText(step.title, 0, activeStep),
      body: decryptText(step.body, 0, activeStep),
    });

    animationFrame = requestAnimationFrame(renderFrame);

    return () => cancelAnimationFrame(animationFrame);
  }, [activeStep, step.body, step.number, step.title]);

  if (auth.isAuthenticated) return <Navigate to="/app" replace />;

  async function login() {
    setError(null);
    setSigningIn(true);
    try {
      const connectedAddress = address || await wallet.connect();
      await auth.loginWithWallet(connectedAddress, wallet.signMessage);
      const state = location.state as { from?: string } | null;
      navigate(state?.from || "/app", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="welcome-overlay">
      <section className="welcome-panel" aria-label="Welcome to Balary">
        <Link to="/" className="welcome-close" aria-label="Close welcome">
          <X size={18} strokeWidth={1.7} />
        </Link>

        <div className="welcome-splash">
          <div className="welcome-carousel" style={carouselStyle} aria-live="off">
            <span className="welcome-sr-status" aria-live="polite">
              {step.number} {step.title}. {step.body}
            </span>

            <WelcomeStepIllustration id={step.id} />

            <div className="welcome-carousel-copy" key={activeStep}>
              <span aria-label={step.number}>{displayStep.number}</span>
              <h2 aria-label={step.title}>{displayStep.title}</h2>
              <p aria-label={step.body}>{displayStep.body}</p>
            </div>

            <div className="welcome-carousel-controls" aria-label="Welcome steps">
              {WELCOME_STEPS.map((item, index) => (
                <button
                  key={item.number}
                  type="button"
                  className={index === activeStep ? "active" : ""}
                  onClick={() => setActiveStep(index)}
                  aria-label={`Show ${item.title}`}
                  aria-current={index === activeStep}
                />
              ))}
            </div>

            <div className="welcome-carousel-loader" key={`loader-${activeStep}`} aria-hidden="true" />
          </div>

          <div className="welcome-wallet-panel">
            <div className="welcome-copy">
              
              
              <p className="welcome-desc">
                Stablecoin payroll for institution registration, HR uploads,
                Finance funding, and employee claims on Flare Coston2.
              </p>
            </div>

            {!address && (
              <div className="welcome-action">
                <button
                  type="button"
                  className="btn btn-primary welcome-connect-button"
                  onClick={login}
                  disabled={wallet.connecting || signingIn}
                >
                  <WalletIcon size={16} strokeWidth={1.8} />
                  {wallet.connecting || signingIn ? "Connecting" : "Connect and sign"}
                </button>
              </div>
            )}

            {address && (
              <div className="welcome-action">
                <div className="welcome-connected-pill">
                  <span className="welcome-connected-pill-dot" />
                  <span>{shortWallet}</span>
                  <strong>connected</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-primary welcome-connect-button"
                  onClick={login}
                  disabled={signingIn}
                >
                  <WalletIcon size={16} strokeWidth={1.8} />
                  {signingIn ? "Signing" : "Sign and enter"}
                </button>
              </div>
            )}

            {error && <div className="form-error">{error}</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
