import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./ui";

export type TransactionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isProcessing?: boolean;
  idleLabel: React.ReactNode;
  processingLabel?: React.ReactNode;
  icon?: React.ComponentType<{ size: number; className?: string }>;
};

/**
 * TransactionButton enhances a standard Button with animated visual feedback
 * while a transaction is processing.
 *
 * While `isProcessing` is true:
 * - A spinner icon animates continuously
 * - The button remains visible and disabled
 * - The processingLabel is shown
 * - Layout does not shift
 *
 * Usage:
 * <TransactionButton
 *   isProcessing={mutation.isPending}
 *   idleLabel="Fund payroll"
 *   processingLabel="Processing..."
 *   onClick={handleClick}
 * />
 */
export function TransactionButton({
  isProcessing = false,
  idleLabel,
  processingLabel,
  icon: IconComponent,
  className = "",
  disabled,
  children,
  ...props
}: TransactionButtonProps) {
  const finalDisabled = disabled || isProcessing;
  const displayLabel = isProcessing && processingLabel ? processingLabel : idleLabel;

  return (
    <Button
      {...props}
      disabled={finalDisabled}
      className={`${className}${isProcessing ? " tx-processing" : ""}`.trim()}
      aria-busy={isProcessing}
      aria-disabled={finalDisabled}
    >
      {isProcessing ? (
        <Loader2 size={16} className="animate-spin" data-testid="transaction-spinner" aria-hidden="true" />
      ) : IconComponent ? (
        <IconComponent size={16} />
      ) : null}
      <span>{displayLabel}</span>
    </Button>
  );
}
