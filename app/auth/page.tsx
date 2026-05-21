'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import BgCanvas from '@/components/BgCanvas'
import { createBrowserClient } from '@/lib/supabase'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'signup' | 'login'>(
    searchParams.get('mode') === 'login' ? 'login' : 'signup'
  )
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showLoginPwd, setShowLoginPwd] = useState(false)

  // Signup fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')

  // Login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Field errors
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const supabase = createBrowserClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/chat')
    })
  }, [])

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  const switchMode = (m: 'signup' | 'login') => {
    setMode(m)
    setAlert(null)
    setErrors({})
    const url = new URL(window.location.href)
    url.searchParams.set('mode', m)
    window.history.replaceState({}, '', url)
  }

  const handleSignup = async () => {
    const errs: Record<string, boolean> = {}
    if (!firstName) errs.firstName = true
    if (!lastName) errs.lastName = true
    if (!validateEmail(signupEmail)) errs.signupEmail = true
    if (signupPassword.length < 8) errs.signupPassword = true
    setErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: { data: { first_name: firstName, last_name: lastName } },
      })
      if (error) throw error
      setShowSuccess(true)
    } catch (err) {
      setAlert({ msg: (err as Error).message || 'Something went wrong.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    const errs: Record<string, boolean> = {}
    if (!validateEmail(loginEmail)) errs.loginEmail = true
    if (!loginPassword) errs.loginPassword = true
    setErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
      if (error) throw error
      router.push('/chat')
    } catch (err) {
      setAlert({ msg: (err as Error).message || 'Invalid email or password.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!validateEmail(loginEmail)) {
      setErrors({ loginEmail: true })
      setAlert({ msg: 'Enter your email address first, then click Forgot Password.', type: 'error' })
      return
    }
    await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: window.location.origin + '/auth?mode=login',
    })
    setAlert({ msg: 'Password reset email sent! Check your inbox.', type: 'success' })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (mode === 'login') handleLogin()
    else handleSignup()
  }

  return (
    <div className="auth-layout" onKeyDown={onKeyDown}>
      {/* Left panel */}
      <div className="auth-left">
        <Link href="/" className="auth-logo">
          <div className="logo-mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="2" y="3" width="20" height="14" rx="1"/><path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <div className="logo-name">ZUUKE<span>.</span></div>
        </Link>
        <div className="auth-hero-text">
          <div className="auth-hero-title">
            <span className="t1">YOUR PERFECT</span>
            <span className="t2">PC BUILD</span>
          </div>
          <p className="auth-hero-sub">Create your free account and get instant access to AI-powered PC build recommendations, saved build history, and expert guidance — all in one place.</p>
        </div>
        <div className="auth-testimonial">
          <div className="testimonial-text">&ldquo;Zuuke specced my entire $1,400 editing build in under a minute. I would have spent three weekends on Reddit doing this myself.&rdquo;</div>
          <div className="testimonial-author">
            <div className="testimonial-avatar">JM</div>
            <div className="testimonial-name">Jake M. · Video Editor</div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-box">
          <div className="auth-tabs">
            <button className={`auth-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => switchMode('signup')}>Sign Up</button>
            <button className={`auth-tab${mode === 'login' ? ' active' : ''}`} onClick={() => switchMode('login')}>Log In</button>
          </div>

          {alert && <div className={`auth-alert ${alert.type} show`}>{alert.msg}</div>}

          {/* Signup */}
          {mode === 'signup' && !showSuccess && (
            <div>
              <div className="auth-heading">CREATE ACCOUNT</div>
              <div className="auth-subheading">// Free forever · No credit card needed</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className={`form-input${errors.firstName ? ' error' : ''}`} type="text" placeholder="Alex" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                  {errors.firstName && <div className="form-error show">Required</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className={`form-input${errors.lastName ? ' error' : ''}`} type="text" placeholder="Chen" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  {errors.lastName && <div className="form-error show">Required</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className={`form-input${errors.signupEmail ? ' error' : ''}`} type="email" placeholder="you@example.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} autoComplete="email" />
                {errors.signupEmail && <div className="form-error show">Enter a valid email</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-wrap">
                  <input className={`form-input${errors.signupPassword ? ' error' : ''}`} type={showPwd ? 'text' : 'password'} placeholder="Min. 8 characters" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} autoComplete="new-password" />
                  <button className="pwd-toggle" type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}>
                    {showPwd ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                <div className="form-hint">At least 8 characters</div>
                {errors.signupPassword && <div className="form-error show">Password must be at least 8 characters</div>}
              </div>
              <button className={`submit-btn${loading ? ' loading' : ''}`} onClick={handleSignup} disabled={loading}>
                <span className="btn-text">Create Free Account →</span>
                <div className="btn-spinner" />
              </button>
              <div className="terms-note">By signing up you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</div>
            </div>
          )}

          {mode === 'signup' && showSuccess && (
            <div className="success-state">
              <div className="success-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="success-title">CHECK YOUR EMAIL</div>
              <div className="success-text">We sent a confirmation link to your email address.<br />Click it to activate your account.</div>
            </div>
          )}

          {/* Login */}
          {mode === 'login' && (
            <div>
              <div className="auth-heading">WELCOME BACK</div>
              <div className="auth-subheading">// Sign in to your Zuuke account</div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className={`form-input${errors.loginEmail ? ' error' : ''}`} type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} autoComplete="email" />
                {errors.loginEmail && <div className="form-error show">Enter a valid email</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <a href="#" className="forgot-link" onClick={handleForgot}>Forgot password?</a>
                <div className="input-wrap">
                  <input className={`form-input${errors.loginPassword ? ' error' : ''}`} type={showLoginPwd ? 'text' : 'password'} placeholder="Your password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" />
                  <button className="pwd-toggle" type="button" onClick={() => setShowLoginPwd(!showLoginPwd)} tabIndex={-1}>
                    {showLoginPwd ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                {errors.loginPassword && <div className="form-error show">Required</div>}
              </div>
              <button className={`submit-btn${loading ? ' loading' : ''}`} onClick={handleLogin} disabled={loading}>
                <span className="btn-text">Sign In →</span>
                <div className="btn-spinner" />
              </button>
              <div className="auth-footer-text" style={{ marginTop: 20 }}>
                Don&apos;t have an account? <a href="#" onClick={(e) => { e.preventDefault(); switchMode('signup') }}>Sign up free</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <>
      <BgCanvas opacity={0.35} particleCount={60} />
      <Suspense>
        <AuthForm />
      </Suspense>
    </>
  )
}
