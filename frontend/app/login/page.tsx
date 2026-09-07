'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, request } from '@/lib/api';

export default function Login() {
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      router.push('/hosted-zones');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="aws-login">
    <header className="aws-login-top"><div className="aws-login-logo">aws<span>⌁</span></div><nav><a href="#feedback">Provide feedback</a><a href="#sessions">Multi-session disabled <span>▾</span></a><a href="#language">English <span>▾</span></a></nav></header>
    <div className="aws-login-pattern" aria-hidden="true"><span /><span /><span /><span /><span /></div>
    <section className="aws-login-content">
      <div className="aws-login-brand">aws<span>⌁</span></div>
      <form className="aws-login-card" onSubmit={submit}>
        <h1>Sign In</h1>
        <p className="aws-login-intro">Access your AWS account by user type.</p>
        <fieldset className="user-type"><legend>User type <a href="#help">(not sure?)</a></legend><label className="user-type-option selected"><input type="radio" name="user-type" defaultChecked /><span><strong>Root user</strong><small>Account owner that performs tasks requiring unrestricted access.</small></span></label><label className="user-type-option"><input type="radio" name="user-type" /><span><strong>IAM user</strong><small>User within an account that performs daily tasks.</small></span></label></fieldset>
        <div className="aws-login-field"><label htmlFor="username">Demo Root User</label><input id="username" autoFocus required value={username} onChange={event => setUsername(event.target.value)} /></div>
        <div className="aws-login-field"><label htmlFor="password">Demo Password</label><input id="password" required type="password" value={password} onChange={event => setPassword(event.target.value)} /></div>
        {error && <div className="error aws-login-error" role="alert">{error}</div>}
        <button className="aws-login-next" disabled={busy} type="submit">{busy ? 'Signing in...' : 'Sign in'}</button>
        <div className="aws-login-or"><span />OR<span /></div>
        <button className="aws-login-signup" type="button">New to AWS? Sign up</button>
        <p className="aws-login-hint">Demo credentials are prefilled for this mock Route 53 console.</p>
      </form>
    </section>
  </main>;
}
