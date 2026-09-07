'use client';

import { useEffect, useState } from 'react';
import { request } from './api';

type User = { id: number; username: string };

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    request('/api/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  return { user, loading };
}
