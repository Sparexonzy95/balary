import { Link, NavLink, Outlet } from "react-router-dom";
import { WalletConnectButton } from "../components/WalletConnectButton";

function BrandMark() {
  return (
    <span className="balary-wordmark" aria-label="Balary">
      <span>B</span>alary
    </span>
  );
}

export function AppShell() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <BrandMark />
          <div className="brand-sub" style={{ alignSelf: "center" }}>
            Arc Payroll
          </div>
        </Link>

        <nav className="nav">
          <NavLink to="/institution" className="navlink">
            Institution
          </NavLink>
          <NavLink to="/hr" className="navlink">
            HR Payroll
          </NavLink>
          <NavLink to="/finance" className="navlink">
            Finance
          </NavLink>
          <NavLink to="/employee/claims" className="navlink">
            Claims
          </NavLink>
        </nav>

        <div className="topbar-right">
          <div className="badge">Flare Coston2</div>
          <WalletConnectButton />
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
