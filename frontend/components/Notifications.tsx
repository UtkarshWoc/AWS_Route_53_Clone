'use client';

import { createContext, useContext, useMemo, useState } from 'react';

type Notice = { id: number; type: 'success' | 'error'; message: string };
type NotificationContext = { notify: (type: Notice['type'], message: string) => void };
const Context = createContext<NotificationContext | null>(null);

export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('useNotifications must be used inside NotificationsProvider');
  return value;
}

export default function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Notice[]>([]);
  const value = useMemo(() => ({ notify: (type: Notice['type'], message: string) => setItems(current => [...current, { id: Date.now(), type, message }]) }), []);
  return <Context.Provider value={value}><div className="flashbar" aria-live="polite">{items.map(item => <div className={`flash ${item.type}`} role={item.type === 'error' ? 'alert' : 'status'} key={item.id}><span>{item.message}</span><button aria-label="Dismiss notification" onClick={() => setItems(current => current.filter(value => value.id !== item.id))}>Dismiss</button></div>)}</div>{children}</Context.Provider>;
}
