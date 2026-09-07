import React from "react";
import {
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ShieldAlert,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useMarkNotificationsRead, useNotifications } from "../hooks/useNotifications";
import type { NotificationItem as ApiNotificationItem } from "../lib/types";
import { Button, ErrorState } from "../components/ui";

type NotificationSection = "today" | "week" | "earlier";
type NotificationTone = "payroll" | "success" | "warning" | "info";

type DisplayNotification = ApiNotificationItem & {
  section: NotificationSection;
  time: string;
  tone: NotificationTone;
  icon: LucideIcon;
};

const NOTIFICATION_TABS: Array<{ id: NotificationSection; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "earlier", label: "Earlier" },
];
const NOTIFICATION_PAGE_SIZE = 5;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sectionForDate(value: string): NotificationSection {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "earlier";

  const today = startOfDay(new Date());
  const createdDay = startOfDay(date);
  if (createdDay.getTime() === today.getTime()) return "today";

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  return createdDay >= sevenDaysAgo ? "week" : "earlier";
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 2 * day) return "Yesterday";
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function notificationTone(type: string, title: string): NotificationTone {
  const normalized = `${type} ${title}`.toLowerCase();
  if (
    normalized.includes("failed") ||
    normalized.includes("expired") ||
    normalized.includes("wallet")
  ) {
    return "warning";
  }
  if (
    normalized.includes("confirmed") ||
    normalized.includes("funded") ||
    normalized.includes("claim") ||
    normalized.includes("active")
  ) {
    return "success";
  }
  if (normalized.includes("payroll") || normalized.includes("role")) {
    return "payroll";
  }
  return "info";
}

function notificationIcon(tone: NotificationTone) {
  if (tone === "success") return CircleCheck;
  if (tone === "warning") return ShieldAlert;
  if (tone === "payroll") return BriefcaseBusiness;
  return WalletCards;
}

function displayNotification(item: ApiNotificationItem): DisplayNotification {
  const tone = notificationTone(item.notification_type, item.title);
  return {
    ...item,
    section: sectionForDate(item.created_at),
    time: relativeTime(item.created_at),
    tone,
    icon: notificationIcon(tone),
  };
}

export function NotificationsPage() {
  const [activeTab, setActiveTab] = React.useState<NotificationSection>("today");
  const [currentPage, setCurrentPage] = React.useState(1);
  const notificationsQuery = useNotifications();
  const markRead = useMarkNotificationsRead();
  const notifications = React.useMemo(
    () => (notificationsQuery.data ?? []).map(displayNotification),
    [notificationsQuery.data],
  );
  const sectionCounts = React.useMemo(
    () =>
      NOTIFICATION_TABS.reduce<Record<NotificationSection, number>>(
        (counts, tab) => ({
          ...counts,
          [tab.id]: notifications.filter((item) => item.section === tab.id).length,
        }),
        { today: 0, week: 0, earlier: 0 },
      ),
    [notifications],
  );
  const activeNotifications = notifications.filter((item) => item.section === activeTab);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const totalPages = Math.max(1, Math.ceil(activeNotifications.length / NOTIFICATION_PAGE_SIZE));
  const visibleNotifications = activeNotifications.slice(
    (currentPage - 1) * NOTIFICATION_PAGE_SIZE,
    currentPage * NOTIFICATION_PAGE_SIZE,
  );

  React.useEffect(() => {
    if (!notifications.length || sectionCounts[activeTab] > 0) return;
    const firstPopulatedTab = NOTIFICATION_TABS.find((tab) => sectionCounts[tab.id] > 0);
    if (firstPopulatedTab) setActiveTab(firstPopulatedTab.id);
  }, [activeTab, notifications.length, sectionCounts]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  }

  function markAllAsRead() {
    if (!unreadCount || markRead.isPending) return;
    markRead.mutate(undefined);
  }

  function markOneAsRead(item: DisplayNotification) {
    if (item.read || markRead.isPending) return;
    markRead.mutate(item.id);
  }

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign notifications-dashboard-page">
      <div className="employer-task-dashboard">
        <section className="employer-task-hero notifications-hero">
          <div className="employer-task-hero-copy">
            <span className="employer-task-kicker">Notifications</span>
            <h1>
              Notification <span>center</span>
            </h1>
            <p className="employer-task-hero-subtitle">
              Track payroll updates, claims, wallet actions, and security alerts.
            </p>
          </div>

          <div className="employer-task-hero-metrics" aria-label="Notification summary">
            <div className="employer-task-hero-metric">
              <span>Unread</span>
              <strong>{unreadCount}</strong>
            </div>
            <div className="employer-task-hero-metric">
              <span>Total</span>
              <strong>{notifications.length}</strong>
            </div>
          </div>
        </section>

        <main className="employer-task-main">
          <section className="employer-task-card employer-payroll-board notifications-center-card" aria-labelledby="notification-center-title">
            <div className="employer-task-card-head notifications-center-head">
              <div>
                <span>Secure payroll feed</span>
                <h2 id="notification-center-title">Notifications</h2>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="notifications-mark-read"
                onClick={markAllAsRead}
                disabled={!unreadCount || markRead.isPending}
              >
                Mark all as read
              </Button>
            </div>

            <div className="notifications-segmented-tabs" role="tablist" aria-label="Notification sections">
              {NOTIFICATION_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`notifications-tab${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  <span>{sectionCounts[tab.id]}</span>
                </button>
              ))}
            </div>

            {notificationsQuery.isLoading ? (
              <div className="employer-task-loading">Loading notifications...</div>
            ) : notificationsQuery.error ? (
              <ErrorState message="Could not load notifications." />
            ) : activeNotifications.length ? (
              <>
                <ul className="notifications-list" aria-label={`${activeTab} notifications`}>
                  {visibleNotifications.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li
                        key={item.id}
                        className={`notifications-list-row notifications-list-row-${item.tone}${
                          !item.read ? " unread" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="notifications-list-row-button"
                          onClick={() => markOneAsRead(item)}
                          aria-label={item.read ? item.title : `Mark ${item.title} as read`}
                        >
                          <span className="notifications-icon-badge" aria-hidden="true">
                            <Icon size={18} strokeWidth={1.8} />
                          </span>

                          <div className="notifications-copy">
                            <div className="notifications-title-line">
                              {!item.read && <span className="notifications-unread-dot" aria-hidden="true" />}
                              <strong>{item.title}</strong>
                            </div>
                            <p>{item.message}</p>
                          </div>

                          <time className="notifications-time">{item.time}</time>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {activeNotifications.length > NOTIFICATION_PAGE_SIZE && (
                  <div className="employee-claims-pagination notifications-pagination" aria-label="Notifications pagination">
                    <span>
                      Showing {(currentPage - 1) * NOTIFICATION_PAGE_SIZE + 1}-
                      {Math.min(currentPage * NOTIFICATION_PAGE_SIZE, activeNotifications.length)} of {activeNotifications.length}
                    </span>
                    <div className="employee-claims-pagination-controls">
                      <button
                        type="button"
                        className="employee-claims-page-btn"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Previous notifications page"
                      >
                        <ChevronLeft size={15} strokeWidth={2} />
                      </button>
                      <span className="employee-claims-page-count">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        className="employee-claims-page-btn"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Next notifications page"
                      >
                        <ChevronRight size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="notifications-empty">No notifications in this section.</div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
