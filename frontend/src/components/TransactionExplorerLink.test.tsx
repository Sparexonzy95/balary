import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransactionExplorerLink } from "./TransactionExplorerLink";

const requestHash = `0x${"ab".repeat(32)}`;
const finalizationHash = `0x${"cd".repeat(32)}`;

describe("TransactionExplorerLink", () => {
  it("builds a Coston2 request link with the full hash and safe new-tab attributes", () => {
    render(<TransactionExplorerLink hash={requestHash} label="View withdrawal request" />);
    const link = screen.getByRole("link", { name: `View withdrawal request: ${requestHash}` });
    expect(link).toHaveAttribute(
      "href",
      `https://coston2-explorer.flare.network/tx/${requestHash}`,
    );
    expect(link).toHaveAttribute("title", `View withdrawal request: ${requestHash}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("0xabab");
  });

  it("hides final settlement before a hash exists and shows it afterward", () => {
    const view = render(
      <TransactionExplorerLink hash={undefined} label="View final settlement" />,
    );
    expect(screen.queryByRole("link", { name: /View final settlement/ })).not.toBeInTheDocument();

    view.rerender(
      <TransactionExplorerLink hash={finalizationHash} label="View final settlement" />,
    );
    expect(
      screen.getByRole("link", { name: `View final settlement: ${finalizationHash}` }),
    ).toHaveAttribute(
      "href",
      `https://coston2-explorer.flare.network/tx/${finalizationHash}`,
    );
  });
});
