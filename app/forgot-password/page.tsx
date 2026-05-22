'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
      }}>

        {/* Logo */}
        <p style={{
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 700,
          color: '#D4FF4F',
          margin: '0 0 40px',
          letterSpacing: '-0.3px',
        }}>
          Leadstaq
        </p>

        <div style={{
          background: '#0a0a0a',
          border: '0.5px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: '36px 32px',
        }}>

          {submitted ? (
            // Success state
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52,
                borderRadius: '50%',
                background: 'rgba(61,214,140,0.1)',
                border: '0.5px solid rgba(61,214,140,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <i className="ti ti-mail-check"
                   style={{ fontSize: 24, color: '#3dd68c' }} />
              </div>
              <h1 style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#ededed',
                margin: '0 0 12px',
              }}>
                Check your email
              </h1>
              <p style={{
                fontSize: 14,
                color: '#71717a',
                lineHeight: 1.6,
                margin: '0 0 28px',
              }}>
                If an account exists for <strong style={{ color: '#a1a1aa' }}>{email}</strong>,
                a reset link has been sent. Check your inbox and spam folder.
              </p>
              <Link href="/login" style={{
                fontSize: 13,
                color: '#D4FF4F',
                textDecoration: 'none',
                fontWeight: 600,
              }}>
                ← Back to login
              </Link>
            </div>
          ) : (
            // Form state
            <>
              <h1 style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#ededed',
                margin: '0 0 8px',
                letterSpacing: '-0.3px',
              }}>
                Forgot password
              </h1>
              <p style={{
                fontSize: 14,
                color: '#71717a',
                margin: '0 0 28px',
                lineHeight: 1.6,
              }}>
                Enter your email and we will send you a reset link.
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
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
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
                  disabled={loading || !email.trim()}
                  style={{
                    width: '100%',
                    height: 44,
                    background: loading || !email.trim()
                      ? '#1a1a1a'
                      : '#D4FF4F',
                    color: loading || !email.trim()
                      ? '#555555'
                      : '#000000',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: loading || !email.trim()
                      ? 'not-allowed'
                      : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <p style={{
                textAlign: 'center',
                marginTop: 24,
                fontSize: 13,
                color: '#555555',
              }}>
                <Link href="/login" style={{
                  color: '#71717a',
                  textDecoration: 'none',
                }}>
                  ← Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
