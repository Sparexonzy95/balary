import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import CollapseIcon from "@iconify-react/hugeicons/collapse";
import ExpandIcon from "@iconify-react/hugeicons/expand";
import LogoutBoldIcon from "@iconify-react/solar/logout-bold";
import WalletBoldIcon from "@iconify-react/solar/wallet-bold";
import {
  Bell,
  Building2,
  CircleDollarSign,
  Landmark,
  ListChecks,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import { DashboardTourProvider } from "../components/tour/DashboardTour";
import { userHasAnyRole } from "../components/RoleRoute";
import { useInstitutions } from "../hooks/useInstitutions";
import { useNotifications } from "../hooks/useNotifications";
import { useAuth } from "../lib/auth";
import type { InstitutionRole } from "../lib/types";
import { useWallet } from "../lib/wallet";

const DASHBOARD_DECRYPT_CHARS = "01BALARYFLAREUSDT#$%";
const DASHBOARD_DECRYPT_DURATION_MS = 520;

type NavItem = {
  id: string;
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  roles?: InstitutionRole[];
  alwaysVisible?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: "institution", to: "/institution", label: "Institution", icon: Building2, roles: ["admin"] },
  { id: "hr", to: "/hr", label: "HR Payroll", icon: ListChecks, roles: ["hr"] },
  { id: "finance", to: "/finance", label: "Finance", icon: Landmark, roles: ["finance"] },
  {
    id: "employee",
    to: "/employee/claims",
    label: "Private Withdrawals",
    icon: CircleDollarSign,
    alwaysVisible: true,
  },
  { id: "notifications", to: "/notifications", label: "Notifications", icon: Bell, alwaysVisible: true },
  { id: "account", to: "/account", label: "Account", icon: UserRound, alwaysVisible: true },
];

function dashboardTabFor(pathname: string) {
  if (pathname === "/app") return "institution";
  if (pathname.startsWith("/institution")) return "institution";
  if (pathname.startsWith("/hr")) return "hr";
  if (pathname.startsWith("/finance")) return "finance";
  if (pathname.startsWith("/employee")) return "employee";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/account")) return "account";
  return "institution";
}

function decryptLabel(value: string, progress: number, salt: number) {
  const revealCount = Math.floor(value.length * progress);
  const noiseFrame = Math.floor(progress * DASHBOARD_DECRYPT_CHARS.length * 2);

  return Array.from(value)
    .map((char, index) => {
      if (!/[a-z0-9]/i.test(char) || index < revealCount) return char;
      return DASHBOARD_DECRYPT_CHARS[
        (index + salt * 3 + noiseFrame) % DASHBOARD_DECRYPT_CHARS.length
      ];
    })
    .join("");
}

function useDecryptLabel(label: string, active: boolean) {
  const [displayLabel, setDisplayLabel] = React.useState(label);

  React.useEffect(() => {
    if (!active) {
      setDisplayLabel(label);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayLabel(label);
      return;
    }

    let animationFrame = 0;
    const start = performance.now();
    const salt = label.length;

    const renderFrame = (now: number) => {
      const elapsed = now - start;
      const linearProgress = Math.min(elapsed / DASHBOARD_DECRYPT_DURATION_MS, 1);
      const easedProgress = 1 - Math.pow(1 - linearProgress, 3);

      setDisplayLabel(decryptLabel(label, easedProgress, salt));

      if (linearProgress < 1) {
        animationFrame = requestAnimationFrame(renderFrame);
      }
    };

    setDisplayLabel(decryptLabel(label, 0, salt));
    animationFrame = requestAnimationFrame(renderFrame);

    return () => cancelAnimationFrame(animationFrame);
  }, [active, label]);

  return displayLabel;
}

function DecryptNavLabel({ label, active }: { label: string; active: boolean }) {
  const displayLabel = useDecryptLabel(label, active);
  return (
    <span className="sidebar-decrypt-label" aria-label={label}>
      {displayLabel}
    </span>
  );
}

function BalaryWordmark() {
  return (
    <span className="balary-wordmark" aria-label="Balary">
      <span>B</span>alary
    </span>
  );
}

function hasRole(
  roles: InstitutionRole[] | undefined,
  institutions: ReturnType<typeof useInstitutions>["data"],
  walletAddress: string | null | undefined,
) {
  if (!roles?.length) return true;
  return userHasAnyRole(institutions, walletAddress, roles);
}

export function AppDashboard() {
  const auth = useAuth();
  const wallet = useWallet();
  const institutions = useInstitutions();
  const notifications = useNotifications();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const location = useLocation();
  const activeTab = dashboardTabFor(location.pathname);
  const walletAddress = auth.account?.wallet_address || wallet.address;
  const rolesReady = !institutions.isLoading;
  const institutionTarget =
    rolesReady && !hasRole(["admin"], institutions.data, walletAddress)
      ? "/institution/register"
      : "/institution";

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.id === "institution") return true;
    if (item.alwaysVisible) return true;
    if (!rolesReady) return false;
    return hasRole(item.roles, institutions.data, walletAddress);
  });
  const unreadNotifications = notifications.data?.filter((item) => !item.read).length ?? 0;
  const unreadNotificationLabel = unreadNotifications > 99 ? "99+" : String(unreadNotifications);

  function handleLogout() {
    auth.logout();
    wallet.disconnect();
  }

  function handleSidebarDoubleClick() {
    if (window.innerWidth <= 768) return;
    setSidebarCollapsed((collapsed) => !collapsed);
  }

  return (
    <DashboardTourProvider>
      <div className="app-dashboard">
        <div
          className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside
          className={`app-sidebar${sidebarOpen ? " open" : ""}${
            sidebarCollapsed ? " collapsed" : ""
          }`}
          onDoubleClick={handleSidebarDoubleClick}
        >
          <div className="sidebar-brand">
            <a
              href="https://balary.lol"
              className="sidebar-logo"
              aria-label="Visit balary.lol"
            >
              <BalaryWordmark />
            </a>
            <button
              type="button"
              className="sidebar-collapse-toggle"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              onDoubleClick={(event) => event.stopPropagation()}
              aria-label={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            >
              {sidebarCollapsed ? (
                <ExpandIcon width="18" height="18" />
              ) : (
                <CollapseIcon width="18" height="18" />
              )}
            </button>
          </div>

          <div className="sidebar-divider-h" />

          <nav className="sidebar-nav">
            <div className="sidebar-menu-label">Menu</div>

            <div className="sidebar-menu-group">
              {visibleNav.map((item, index) => {
                const Icon = item.icon;
                const to = item.id === "institution" ? institutionTarget : item.to;
                const active = activeTab === item.id;

                return (
                  <React.Fragment key={item.id}>
                    {index > 0 && <div className="sidebar-item-divider" />}
                    <NavLink
                      data-tour={`nav-${item.id}`}
                      to={to}
                      className={`sidebar-nav-item${active ? " active" : ""}`}
                    >
                      <div className="sidebar-nav-icon-wrap">
                        <Icon size={18} strokeWidth={1.8} />
                        {item.id === "notifications" && unreadNotifications > 0 && (
                          <span
                            className="sidebar-notification-badge"
                            aria-label={`${unreadNotifications} unread notifications`}
                          >
                            {unreadNotificationLabel}
                          </span>
                        )}
                      </div>
                      <DecryptNavLabel label={item.label} active={active} />
                    </NavLink>
                  </React.Fragment>
                );
              })}
            </div>
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-item-divider" />

            <div className="sidebar-profile sidebar-footer-wallet">
              <div className="sidebar-profile-avatar">
                <WalletBoldIcon width="18" height="18" />
              </div>
              <div className="sidebar-profile-info">
                <div className="sidebar-profile-name">
                  {shortWallet ?? "Not Connected"}
                </div>
              </div>
            </div>

            {walletAddress && (
              <>
                <div className="sidebar-item-divider" />
                <button
                  type="button"
                  className="sidebar-nav-item sidebar-footer-action sidebar-disconnect-btn"
                  onClick={handleLogout}
                >
                  <LogoutBoldIcon width="18" height="18" />
                  <span>Log Out</span>
                </button>
              </>
            )}

          </div>
        </aside>

        <div className="app-content">
          <div className="app-mobile-topbar">
            <a href="https://balary.lol" aria-label="Visit balary.lol">
              <BalaryWordmark />
            </a>
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="mobile-menu-toggle"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={18} strokeWidth={1.8} /> : <Menu size={18} strokeWidth={1.8} />}
            </button>
          </div>

          <div key={activeTab} className="app-route-decrypt">
            <Outlet />
          </div>
        </div>
      </div>
    </DashboardTourProvider>
  );
}
