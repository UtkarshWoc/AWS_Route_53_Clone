'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { request } from '@/lib/api';
import NotificationsProvider from './Notifications';
import { TopNav } from './TopNav';

type NavItem = { label: string; href: string; badge?: string };
type Group = { label: string; items: NavItem[] };

const primary: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Hosted zones', href: '/hosted-zones' },
  { label: 'Health checks', href: '/health-checks' },
  { label: 'Profiles', href: '/profiles' },
];
const groups: Group[] = [
  { label: 'Global Resolver', items: [{ label: 'Global resolvers', href: '/resolver', badge: 'New' }, { label: 'Shared DNS views', href: '/resolver', badge: 'New' }] },
  { label: 'VPC Resolver', items: ['VPCs', 'Inbound endpoints', 'Outbound endpoints', 'Rules', 'Query logging', 'Outposts'].map(label => ({ label, href: '/resolver' })) },
  { label: 'Domains', items: ['Registered domains', 'Requests'].map(label => ({ label, href: '/traffic-policies' })) },
  { label: 'IP-based routing', items: [{ label: 'CIDR collections', href: '/traffic-policies' }] },
  { label: 'Traffic flow', items: ['Traffic policies', 'Policy records'].map(label => ({ label, href: '/traffic-policies' })) },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [popover, setPopover] = useState<'account' | 'global' | null>(null);
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const createZonePage = path === '/hosted-zones/new';

  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') setPopover(null);
      if (event instanceof MouseEvent && popoverRef.current && !popoverRef.current.contains(event.target as Node)) setPopover(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, []);

  async function logout() {
    await request('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }
  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (search.trim()) router.push(`/hosted-zones?q=${encodeURIComponent(search.trim())}`);
  }
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  const toggleGroup = (label: string) => setCollapsed(current => ({ ...current, [label]: !current[label] }));

  return <NotificationsProvider>
      <TopNav 
        search={search} 
        setSearch={setSearch} 
        submitSearch={submitSearch}
        sidebarCollapsed={sidebarCollapsed} 
        setSidebarCollapsed={setSidebarCollapsed} 
        createZonePage={createZonePage}
        logout={logout}
      />
    <div className={`shell${createZonePage ? ' shell-create' : ''}${sidebarCollapsed ? ' sidebar-is-collapsed' : ''}`}>
      {!createZonePage && <nav className={`side${sidebarCollapsed ? ' is-collapsed' : ''}`} aria-label="Route 53 navigation">
        <div className="side-title"><h3>Route 53</h3><button className="side-collapse" aria-label="Collapse navigation" aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed(true)}>‹</button></div>
        <div className="side-links">
          {primary.map(item => <Link className={active(item.href) ? 'active' : ''} href={item.href} key={item.label}>{item.label}</Link>)}
          {groups.map(group => { const isCollapsed = collapsed[group.label]; return <section className={`nav-group${isCollapsed ? ' collapsed' : ''}`} key={group.label}><button className="nav-group-toggle" aria-expanded={!isCollapsed} onClick={() => toggleGroup(group.label)}><span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>{group.label}</button>{!isCollapsed && group.items.map(item => <Link className={active(item.href) && item.label === 'Traffic policies' ? 'active' : ''} href={item.href} key={item.label}>{item.label}{item.badge && <span className="nav-badge">{item.badge}</span>}</Link>)}</section>; })}
        </div>
        <div className="side-external-links"><a href="#dns-firewall">DNS Firewall <span aria-hidden="true">↗</span></a><a href="#arc">Application Recovery Controller <span aria-hidden="true">↗</span></a></div>
      </nav>}
      <main className="content">{children}</main>
    </div>
    <footer className="console-footer"><div><a href="#cloudshell">▣ CloudShell</a><a href="#toolkit">▣ Agent Toolkit for AWS</a><a href="#feedback">Feedback</a><a href="#mobile">▣ Console Mobile App</a></div><div><span>© 2026, Amazon Web Services, Inc. or its affiliates.</span><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#cookies">Cookie preferences</a></div></footer>
  </NotificationsProvider>;
}
