import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import styles from './TopNav.module.css';

export type ConsoleSearchHandle = {
  open: () => void;
};

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11l3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function HexagonQIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L14 4.5V11.5L8 14.5L2 11.5V4.5L8 1.5Z" stroke="currentColor" strokeWidth="1.2"/>
      <text x="50%" y="70%" textAnchor="middle" fill="currentColor" fontSize="7" fontWeight="bold">Q</text>
    </svg>
  );
}

export const ConsoleSearch = forwardRef<ConsoleSearchHandle, any>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  
  useImperativeHandle(ref, () => ({
    open: () => {
      inputRef.current?.focus();
    },
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/hosted-zones?q=${encodeURIComponent(query.trim())}`;
    }
  };

  return (
    <form className={`${styles.search} ${props.className || ''}`} onSubmit={handleSubmit}>
      <div className={styles.searchIcon}>
        <SearchIcon />
      </div>
      <input
        ref={inputRef}
        className={styles.searchInput}
        placeholder="Search"
        aria-label="Global search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.shortcut}>[Alt+S]</div>
      <button type="button" className={styles.historyButton} aria-label="Amazon Q in Search">
        <HexagonQIcon />
      </button>
    </form>
  );
});
ConsoleSearch.displayName = "ConsoleSearch";
