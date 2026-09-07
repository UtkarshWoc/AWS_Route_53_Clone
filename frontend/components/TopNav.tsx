"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { CONSOLE_ACCOUNT } from "@/lib/constants/console";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useNotifications } from "@/lib/notifications/useNotifications";
import { AccountDropdown } from "./AccountDropdown";
import { ConsoleSearch, type ConsoleSearchHandle } from "./ConsoleSearch";
import { NotificationsDropdown } from "./NotificationsDropdown";
import styles from "./TopNav.module.css";

function IconButton({
  label,
  children,
  onClick,
  active,
  controls,
  badge,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  controls?: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      className={`${styles.iconButton}${active ? ` ${styles.iconButtonActive}` : ""}`}
      aria-label={label}
      aria-expanded={active}
      aria-controls={controls}
      onClick={onClick}
    >
      {children}
      {badge && badge > 0 ? (
        <span className={styles.notifBadge} aria-hidden>
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function Divider() {
  return <span className={styles.divider} aria-hidden />;
}

/** Filled caret — pointUp matches the account tab in Console */
function Caret({ pointUp = false }: { pointUp?: boolean }) {
  return (
    <svg
      className={styles.caret}
      width="8"
      height="6"
      viewBox="0 0 8 6"
      fill="currentColor"
      aria-hidden
      style={pointUp ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M0.8 1.2h6.4L4 5.2 0.8 1.2z" />
    </svg>
  );
}

function ServicesGridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1" y="1" width="3.2" height="3.2" rx="0.4" />
      <rect x="6.4" y="1" width="3.2" height="3.2" rx="0.4" />
      <rect x="11.8" y="1" width="3.2" height="3.2" rx="0.4" />
      <rect x="1" y="6.4" width="3.2" height="3.2" rx="0.4" />
      <rect x="6.4" y="6.4" width="3.2" height="3.2" rx="0.4" />
      <rect x="11.8" y="6.4" width="3.2" height="3.2" rx="0.4" />
      <rect x="1" y="11.8" width="3.2" height="3.2" rx="0.4" />
      <rect x="6.4" y="11.8" width="3.2" height="3.2" rx="0.4" />
      <rect x="11.8" y="11.8" width="3.2" height="3.2" rx="0.4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M11 11l3.2 3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloudShellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.75"
        y="2.75"
        width="12.5"
        height="10.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4.5 6.25L6.75 8L4.5 9.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.25 10.25H11.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.75a3.75 3.75 0 013.75 3.75v1.7c0 .55.16 1.09.46 1.55l.84 1.3A1 1 0 0112.2 11.5H3.8a1 1 0 01-.85-1.55l.84-1.3c.3-.46.46-1 .46-1.55V5.5A3.75 3.75 0 018 1.75z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6.25 12.25a1.75 1.75 0 003.5 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.35 6.2a1.7 1.7 0 013.3.55c0 1.05-.9 1.5-1.55 1.85-.4.2-.6.4-.6.85v.35"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.55" r="0.7" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.7 1.7h2.6l.35 1.55c.4.15.78.36 1.12.62l1.5-.7 1.3 1.3-.7 1.5c.26.34.47.72.62 1.12L15 6.7v2.6l-1.55.35c-.15.4-.36.78-.62 1.12l.7 1.5-1.3 1.3-1.5-.7c-.34.26-.72.47-1.12.62L9.3 15H6.7l-.35-1.55a4.9 4.9 0 01-1.12-.62l-1.5.7-1.3-1.3.7-1.5a4.9 4.9 0 01-.62-1.12L1 9.3V6.7l1.55-.35c.15-.4.36-.78.62-1.12l-.7-1.5 1.3-1.3 1.5.7c.34-.26.72-.47 1.12-.62L6.7 1.7z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/**
 * Dark AWS Management Console header — 48px desktop height.
 */
export function TopNav() {
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<ConsoleSearchHandle>(null);
  const menuId = useId();
  const notificationsId = useId();
  const { session } = useAuth();
  const notifications = useNotifications();
  const displayName = session?.displayName ?? CONSOLE_ACCOUNT.displayName;
  const accountId = session?.accountId ?? CONSOLE_ACCOUNT.accountId;

  useEffect(() => {
    if (!accountOpen && !notificationsOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        accountOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(target)
      ) {
        setAccountOpen(false);
      }
      if (
        notificationsOpen &&
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen, notificationsOpen]);

  return (
    <header className={styles.topNav} role="banner">
      <div className={styles.left}>
        <a href="/" className={styles.logoLink} aria-label="Amazon Web Services">
          <Image
            className={styles.logoImage}
            src="/assets/aws-logo.svg"
            alt="AWS"
            width={37}
            height={20}
            priority
          />
        </a>

        <Divider />

        <button type="button" className={styles.qButton} aria-label="Amazon Q">
          <Image
            className={styles.qIcon}
            src="/assets/amazon-q.svg"
            alt=""
            width={28}
            height={28}
            aria-hidden
          />
        </button>

        <Divider />

        <IconButton label="Services">
          <ServicesGridIcon />
        </IconButton>
      </div>

      <div className={styles.center}>
        <ConsoleSearch ref={searchRef} className={styles.searchDesktop} />
      </div>

      <div className={styles.right}>
        <span className={styles.mobileOnly}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Search"
            onClick={() => searchRef.current?.open()}
          >
            <SearchIcon />
          </button>
        </span>

        <IconButton label="CloudShell">
          <CloudShellIcon />
        </IconButton>
        <Divider />
        <div className={styles.notificationsCluster} ref={notificationsRef}>
          <IconButton
            label="Notifications"
            active={notificationsOpen}
            controls={notificationsId}
            badge={notifications.length}
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setAccountOpen(false);
            }}
          >
            <BellIcon />
          </IconButton>
          {notificationsOpen ? (
            <NotificationsDropdown id={notificationsId} />
          ) : null}
        </div>

        <span className={styles.desktopOnly}>
          <Divider />
          <IconButton label="Help">
            <HelpIcon />
          </IconButton>
          <Divider />
          <IconButton label="Settings">
            <SettingsIcon />
          </IconButton>
          <Divider />
          <button type="button" className={styles.regionButton} aria-label="Regions">
            Global
            <Caret />
          </button>
        </span>

        <div className={styles.accountCluster} ref={accountMenuRef}>
          <div className={`${styles.accountMenu} ${styles.desktopOnly}`}>
            <button
              type="button"
              className={`${styles.accountPill}${accountOpen ? ` ${styles.accountPillOpen}` : ""}`}
              aria-label="Account menu"
              aria-expanded={accountOpen}
              aria-controls={menuId}
              onClick={() => {
                setAccountOpen((open) => !open);
                setNotificationsOpen(false);
              }}
            >
              {displayName} ({accountId})
              <Caret pointUp={accountOpen} />
            </button>
            <span className={styles.accountUsername}>{displayName}</span>
          </div>

          <button
            type="button"
            className={`${styles.moreButton} ${styles.mobileOnly}`}
            aria-label="More"
            aria-expanded={accountOpen}
            aria-controls={menuId}
            onClick={() => {
              setAccountOpen((open) => !open);
              setNotificationsOpen(false);
            }}
          >
            More
            <Caret pointUp={accountOpen} />
          </button>

          {accountOpen ? (
            <AccountDropdown
              id={menuId}
              onSignedOut={() => setAccountOpen(false)}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
