import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NetworkWarning } from "./NetworkWarning";

vi.mock("../lib/wallet", () => ({
  useWallet: () => ({
    address: "0x1111111111111111111111111111111111111111",
    chainId: 1,
    ensureCoston2: vi.fn(),
  }),
}));

describe("NetworkWarning", () => {
  it("appears when the connected wallet is not on Flare Coston2", () => {
    render(<NetworkWarning />);
    expect(screen.getByRole("button", { name: /switch to flare coston2/i })).toBeInTheDocument();
  });
});
