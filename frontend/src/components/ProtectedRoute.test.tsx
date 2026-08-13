import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    account: null,
  }),
}));

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to login", () => {
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<div>Protected app</div>} />
          </Route>
          <Route path="/login" element={<div>Login screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login screen")).toBeInTheDocument();
    expect(screen.queryByText("Protected app")).not.toBeInTheDocument();
  });
});

