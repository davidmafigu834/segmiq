'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [userName, setUserName] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('No reset token found. Please request a new reset link.');
      setValidating(false);
      return;
    }

    fetch(`/api/auth/validate-reset-token?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setTokenValid(true);
          setUserName(data.userName || '');
        } else {
          setTokenError(
            data.error === 'Token expired'
              ? 'This reset link has expired. Please request a new one.'
              : data.error === 'Token already used'
              ? 'This reset link has already been used. Please request a new one.'
              : 'This reset link is invalid. Please request a new one.'
          );
        }
        setValidating(false);
      })
      .catch(() => {
        setTokenError('Could not validate your reset link. Please try again.');
        setValidating(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error || 'Failed to reset password. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 400,
    background: '#0a0a0a',
    border: '0.5px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '36px 32px',
  };

  if (validating) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', color: '#71717a', fontSize: 14 }}>
          Validating your reset link...
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div style={containerStyle}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <p style={{
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 700,
            color: '#D4FF4F',
            margin: '0 0 40px',
          }}>
            Segmiq
          </p>
          <div style={cardStyle}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52,
                borderRadius: '50%',
                background: 'rgba(255,68,68,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <i className="ti ti-link-off"
                   style={{ fontSize: 24, color: '#ff4444' }} />
              </div>
              <h1 style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#ededed',
                margin: '0 0 12px',
              }}>
                Link invalid
              </h1>
              <p style={{
                fontSize: 14,
                color: '#71717a',
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}>
                {tokenError}
              </p>
              <Link href="/forgot-password" style={{
                display: 'inline-block',
                padding: '10px 20px',
                background: '#D4FF4F',
                color: '#000000',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}>
                Request new link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={containerStyle}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <p style={{
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 700,
            color: '#D4FF4F',
            margin: '0 0 40px',
          }}>
            Segmiq
          </p>
          <div style={cardStyle}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52,
                borderRadius: '50%',
                background: 'rgba(61,214,140,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <i className="ti ti-circle-check"
                   style={{ fontSize: 24, color: '#3dd68c' }} />
              </div>
              <h1 style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#ededed',
                margin: '0 0 12px',
              }}>
                Password reset
              </h1>
              <p style={{
                fontSize: 14,
                color: '#71717a',
                lineHeight: 1.6,
                margin: 0,
              }}>
                Your password has been updated. Redirecting you to login...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <p style={{
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 700,
          color: '#D4FF4F',
          margin: '0 0 40px',
        }}>
          Segmiq
        </p>
        <div style={cardStyle}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#ededed',
            margin: '0 0 8px',
            letterSpacing: '-0.3px',
          }}>
            {userName ? `New password, ${userName.split(' ')[0]}` : 'Set new password'}
          </h1>
          <p style={{
            fontSize: 14,
            color: '#71717a',
            margin: '0 0 28px',
            lineHeight: 1.6,
          }}>
            Choose a strong password. Minimum 8 characters.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: '#a1a1aa',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 14px',
                  background: '#111111',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  fontSize: 14,
                  color: '#ededed',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: '#a1a1aa',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your new password"
                required
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 14px',
                  background: '#111111',
                  border: `0.5px solid ${
                    confirm && confirm !== password
                      ? 'rgba(255,68,68,0.4)'
                      : 'rgba(255,255,255,0.1)'
                  }`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: '#ededed',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {confirm && confirm !== password && (
                <p style={{
                  fontSize: 12,
                  color: '#ff4444',
                  margin: '6px 0 0',
                }}>
                  Passwords do not match
                </p>
              )}
            </div>

            {error && (
              <p style={{
                fontSize: 13,
                color: '#ff4444',
                margin: '0 0 16px',
              }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || password.length < 8 || password !== confirm}
              style={{
                width: '100%',
                height: 44,
                background: loading || password.length < 8 || password !== confirm
                  ? '#1a1a1a'
                  : '#D4FF4F',
                color: loading || password.length < 8 || password !== confirm
                  ? '#555555'
                  : '#000000',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: loading || password.length < 8 || password !== confirm
                  ? 'not-allowed'
                  : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? 'Updating...' : 'Reset password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          minHeight: '100vh',
          background: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#71717a',
          fontSize: 14,
          fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
        }}>
          Loading...
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
