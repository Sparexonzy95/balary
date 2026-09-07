import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransactionButton } from "./TransactionButton";

describe("TransactionButton", () => {
  it("switches between idle and processing feedback without removing the button", () => {
    const view = render(
      <TransactionButton idleLabel="Fund payroll" processingLabel="Confirm in wallet..." />,
    );

    const button = screen.getByRole("button", { name: "Fund payroll" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByTestId("transaction-spinner")).not.toBeInTheDocument();

    view.rerender(
      <TransactionButton
        idleLabel="Fund payroll"
        processingLabel="Confirm in wallet..."
        isProcessing
      />,
    );

    expect(screen.getByRole("button", { name: "Confirm in wallet..." })).toBe(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("tx-processing");
    expect(screen.getByTestId("transaction-spinner")).toHaveClass("animate-spin");

    view.rerender(
      <TransactionButton idleLabel="Fund payroll" processingLabel="Confirm in wallet..." />,
    );

    expect(screen.getByRole("button", { name: "Fund payroll" })).toBeEnabled();
    expect(screen.queryByTestId("transaction-spinner")).not.toBeInTheDocument();
  });
});