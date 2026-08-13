import React from "react";
import { createPortal } from "react-dom";
import { CircleCheck } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "primary",
  size,
  className = "",
  ...props
}: ButtonProps) {
  const sizeClass = size === "sm" ? "btn-small" : size === "lg" ? "btn-large" : "";
  return (
    <button
      {...props}
      className={`btn btn-${variant} ${sizeClass} ${className}`.trim()}
    />
  );
}

export function Card({
  title,
  subtitle,
  eyebrow,
  children,
  glass,
  actions,
  className = "",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  glass?: boolean;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${glass ? "glass-card" : "card"} ${className}`.trim()}>
      {(title || subtitle || eyebrow || actions) && (
        <div className="card-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function GlassCard({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`glass-card ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

export function StatusBadge({ value }: { value?: string | null }) {
  const normalized = String(value ?? "unknown")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const display =
    {
      active: "Active",
      finalized: "completed",
      finalised: "completed",
      finalized_success: "completed",
      finalised_success: "completed",
      scheduled: "Scheduled",
    }[normalized] ?? normalized.replace(/_/g, " ");
  return <span className={`status status-${normalized}`}>{display}</span>;
}

export function Field({
  label,
  help,
  error,
  children,
}: {
  label: React.ReactNode;
  help?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help && (
        <span className="muted" style={{ fontSize: "0.78rem" }}>
          {help}
        </span>
      )}
      {error && <span className="text-danger">{error}</span>}
    </label>
  );
}

export function StatCard({
  value,
  label,
  accent,
  tone,
}: {
  value: React.ReactNode;
  label: string;
  accent?: boolean;
  tone?: "accent" | "default";
}) {
  const isAccent = accent || tone === "accent";
  return (
    <div className={`stat-card${isAccent ? " accent-card" : ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function AddressPill({
  value,
  full,
  href,
}: {
  value: string;
  full?: boolean;
  href?: string;
}) {
  const display = full ? value : value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "-";

  if (href) {
    return (
      <a
        className="address-pill"
        href={href}
        target="_blank"
        rel="noreferrer"
        title={value}
      >
        {display}
      </a>
    );
  }

  return (
    <span className="address-pill" title={value}>
      {display}
    </span>
  );
}

export function ExternalAnchor({
  href,
  children,
}: {
  href?: string | null;
  children: React.ReactNode;
}) {
  if (!href) return <span>{children}</span>;
  return (
    <a className="address-pill" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M9 9h6M9 13h4" />
        </svg>
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState({
  message,
  label,
}: {
  message?: string;
  label?: string;
}) {
  return (
    <div className="loading-state">
      {message || label || "Loading..."}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="error-state" role="alert">
      {message || "Something went wrong."}
    </div>
  );
}

export function SuccessNote({ children }: { children: React.ReactNode }) {
  return <div className="note-success">{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  accentTitle,
  description,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  accentTitle?: string;
  description?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="page-header-eyebrow">{eyebrow}</div>}
        <h1>
          {title}
          {accentTitle && (
            <>
              <br />
              <span className="accent">{accentTitle}</span>
            </>
          )}
        </h1>
        {description && <p className="desc">{description}</p>}
        {meta && <div className="page-header-meta">{meta}</div>}
      </div>
      {actions && (
        <div className="row" style={{ flexShrink: 0, alignItems: "flex-start" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div className="section-title">{title}</div>
      {action}
    </div>
  );
}

type Toast = {
  id: number;
  title: string;
  message?: string;
  kind?: "success" | "error" | "info";
};

type CompletionNotice = {
  id: number;
  title: string;
  message?: string;
};

type ToastCtx = {
  push: (toast: Omit<Toast, "id">) => void;
  complete: (notice: Omit<CompletionNotice, "id">) => void;
  dismissCompletion: () => void;
};

const ToastContext = React.createContext<ToastCtx>({
  push: () => undefined,
  complete: () => undefined,
  dismissCompletion: () => undefined,
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [completion, setCompletion] = React.useState<CompletionNotice | null>(null);

  const push = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((cur) => [...cur, { id, ...toast }]);
    setTimeout(() => {
      setToasts((cur) => cur.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const complete = React.useCallback((notice: Omit<CompletionNotice, "id">) => {
    setCompletion({
      id: Date.now() + Math.floor(Math.random() * 1000),
      ...notice,
    });
  }, []);

  const dismissCompletion = React.useCallback(() => {
    setCompletion(null);
  }, []);

  const completionDialog = completion ? (
    <div
      className="claim-completion-overlay claim-detail-completion-overlay run-activation-overlay balary-success-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="balary-success-title"
      aria-describedby={completion.message ? "balary-success-message" : undefined}
    >
      <div className="claim-completion-popover">
        <div className="claim-completion-icon" aria-hidden="true">
          <CircleCheck size={34} strokeWidth={1.8} />
        </div>

        <div className="claim-completion-copy">
          <h2 id="balary-success-title">{completion.title}</h2>
          {completion.message && <p id="balary-success-message">{completion.message}</p>}
        </div>

        <Button
          type="button"
          variant="secondary"
          className="claim-completion-action"
          onClick={dismissCompletion}
        >
          Close
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <ToastContext.Provider value={{ push, complete, dismissCompletion }}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind ?? "info"}`}>
            <strong>{toast.title}</strong>
            {toast.message && <div>{toast.message}</div>}
          </div>
        ))}
      </div>
      {completionDialog && createPortal(completionDialog, document.body)}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}
