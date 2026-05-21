'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import BgCanvas from '@/components/BgCanvas'
import { createBrowserClient } from '@/lib/supabase'

export default function LandingPage() {
  const [userName, setUserName] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle('scrolled', window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const name =
          (session.user.user_metadata as Record<string, string>)?.first_name ||
          session.user.email?.split('@')[0] ||
          null
        setUserName(name)
      }
    })
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible')
            if (e.target.classList.contains('features-grid')) {
              e.target.querySelectorAll('.feature-card').forEach((c, i) => {
                setTimeout(() => c.classList.add('visible'), i * 80)
              })
            }
          }
        })
      },
      { threshold: 0.12 }
    )
    document.querySelectorAll('.step,.terminal,.feature-card,.demo-chat,.price-card').forEach((el) =>
      observer.observe(el)
    )
    const fg = document.querySelector('.features-grid')
    if (fg) observer.observe(fg)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <BgCanvas opacity={0.6} particleCount={120} connectDistance={120} />

      <nav ref={navRef} className="nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="2" y="3" width="20" height="14" rx="1" /><path d="M8 21h8M12 17v4" />
              <path d="M7 8h2M11 8h6M7 11h4M13 11h4" />
            </svg>
          </div>
          <span className="nav-wordmark">ZUUKE<span>.</span></span>
        </Link>
        <div className="nav-links">
          <a href="#how-it-works">How It Works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/about">About Us</Link>
        </div>
        {userName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mist)' }}>
              Hi, <span style={{ color: 'var(--cyan)' }}>{userName}</span>
            </span>
            <Link href="/chat" className="nav-cta"><span>Go to Chat →</span></Link>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/auth?mode=login" className="nav-login">
              Log In
            </Link>
            <Link href="/chat" className="nav-cta"><span>Start Building →</span></Link>
          </div>
        )}
      </nav>

      <section className="hero">
        <div className="hero-eyebrow">AI-Powered · PC Build Intelligence · Real-Time</div>
        <h1 className="hero-title">
          <span className="line-1">BUILD YOUR</span>
          <span className="line-2">PERFECT RIG</span>
          <span className="line-3">INSTANTLY</span>
        </h1>
        <p className="hero-sub">Tell Zuuke your budget and use case. Get a complete, compatible, optimized PC build in seconds — not hours of research.</p>
        <div className="hero-actions">
          <Link href="/chat" className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            Start Building Free
          </Link>
          <a href="#how-it-works" className="btn-secondary">See How It Works</a>
        </div>
      </section>

      <section className="how-it-works" id="how-it-works" style={{ position: 'relative', zIndex: 1 }}>
        <div className="section-label">Process</div>
        <h2 className="section-title">THREE STEPS.<br />ONE PERFECT BUILD.</h2>
        <div className="hiw-grid">
          <div className="hiw-steps">
            {[
              { num: '01', title: 'Tell Us Your Mission', text: 'Gaming at 1440p? Video editing? Streaming? Give Zuuke your budget and use case in plain English. No technical knowledge needed.' },
              { num: '02', title: 'AI Analyzes & Optimizes', text: 'Zuuke checks compatibility, balances performance across components, avoids bottlenecks, and maximizes value for every dollar in your budget.' },
              { num: '03', title: 'Get Your Complete Build', text: 'A full parts list with prices, purchase links, and explanations for every choice. Ask follow-up questions, swap parts, adjust budget — all in real time.' },
            ].map((s) => (
              <div className="step" key={s.num}>
                <div className="step-num">{s.num}</div>
                <div><div className="step-title">{s.title}</div><div className="step-text">{s.text}</div></div>
              </div>
            ))}
          </div>
          <div className="terminal">
            <div className="terminal-bar">
              <div className="t-dot" /><div className="t-dot" /><div className="t-dot" />
              <div className="t-title">zuuke_ai — build_session</div>
            </div>
            <div className="terminal-body">
              <div><span className="t-prompt">user@zuuke:~$ </span><span className="t-input">Build me a gaming PC for $1,200. Competitive FPS, high FPS at 1080p.</span></div>
              <br />
              <div className="t-response">
                <span className="t-key">Analyzing</span> use case...<br />
                <span className="t-key">Priority:</span> <span className="t-val">CPU + GPU for high FPS</span><br />
                <span className="t-key">Bottleneck check:</span> <span className="t-val">passed ✓</span><br />
                <span className="t-key">Compatibility:</span> <span className="t-val">all parts verified ✓</span><br /><br />
                <span className="t-key">CPU   →</span> <span className="t-val">AMD Ryzen 5 7600X</span>   $229<br />
                <span className="t-key">GPU   →</span> <span className="t-val">RTX 4070 Super</span>       $599<br />
                <span className="t-key">RAM   →</span> <span className="t-val">32GB DDR5-6000</span>        $89<br />
                <span className="t-key">MOBO  →</span> <span className="t-val">B650 Tomahawk</span>         $179<br />
                <span className="t-key">SSD   →</span> <span className="t-val">WD Black SN850X 1TB</span>  $89<br />
                <span className="t-key">PSU   →</span> <span className="t-val">Corsair RM750e</span>        $89<br />
                ──────────────────────────<br />
                <span className="t-key">TOTAL →</span> <span className="t-val">$1,174</span> <span style={{ color: '#6b7f96' }}>($26 under budget)</span><span className="t-cursor" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features" style={{ position: 'relative', zIndex: 1 }}>
        <div className="features-inner">
          <div className="section-label">Capabilities</div>
          <h2 className="section-title">BUILT FOR<br />BUILDERS.</h2>
          <div className="features-grid">
            {[
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>, title: 'Full Build Generation', text: 'CPU, GPU, motherboard, RAM, storage, PSU, case — every component selected, explained, and optimized for your exact use case and budget.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>, title: 'Bottleneck Detection', text: 'Zuuke automatically flags and eliminates CPU-GPU bottlenecks, ensuring every dollar contributes to real-world performance gains.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title: 'Upgrade Path Planning', text: "Already have parts? Tell Zuuke what you own. It'll build around your existing components and map your future upgrade path." },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>, title: 'Multi-Use Case Tuning', text: "Gaming, video editing, 3D rendering, streaming, workstation — Zuuke understands each workload's unique hardware demands." },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, title: 'Budget Optimization', text: 'From $400 budget builds to $5,000 enthusiast rigs, Zuuke extracts maximum performance per dollar at every price point.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, title: 'Conversational Refinement', text: "Not happy with a part? Just say so. Swap the GPU, change the case, add peripherals — Zuuke adapts instantly." },
            ].map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-text">{f.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="demo-section" style={{ position: 'relative', zIndex: 1 }}>
        <div className="section-label">Live Preview</div>
        <h2 className="section-title">SEE ZUUKE<br />IN ACTION.</h2>
        <div className="demo-chat">
          <div className="demo-chat-bar">
            <div className="demo-chat-avatar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="1"/><path d="M8 21h8M12 17v4"/></svg></div>
            <div className="demo-chat-name">ZUUKE AI — PC BUILD ASSISTANT</div>
            <div className="demo-status"><div className="demo-dot" />Online</div>
          </div>
          <div className="demo-messages">
            <div className="demo-msg user">
              <div className="demo-msg-avatar">YOU</div>
              <div className="demo-bubble">I want to build a PC for video editing and occasional gaming. Budget is $2,000. I edit 4K footage in Premiere Pro.</div>
            </div>
            <div className="demo-msg ai">
              <div className="demo-msg-avatar">AI</div>
              <div className="demo-bubble">
                Perfect use case for a balanced workstation-gaming build. For 4K Premiere Pro, I&apos;ll prioritize a fast CPU with many cores, 64GB RAM, and a GPU with strong CUDA performance.
                <div className="part-list">
                  <div className="part-item"><span className="part-name">AMD Ryzen 9 7900X (12-core)</span><span className="part-price">$399</span></div>
                  <div className="part-item"><span className="part-name">NVIDIA RTX 4070 Ti Super</span><span className="part-price">$599</span></div>
                  <div className="part-item"><span className="part-name">64GB DDR5-6000 (2×32GB)</span><span className="part-price">$169</span></div>
                  <div className="part-item"><span className="part-name">ASUS ProArt X670E-Creator</span><span className="part-price">$329</span></div>
                  <div className="part-item"><span className="part-name">2TB WD Black SN850X NVMe</span><span className="part-price">$149</span></div>
                  <div className="part-item"><span className="part-name">Fractal Design North + 850W PSU</span><span className="part-price">$189</span></div>
                  <div className="part-total"><span className="part-name">Total</span><span className="part-price">$2,034</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing" id="pricing" style={{ position: 'relative', zIndex: 1 }}>
        <div className="pricing-inner">
          <div className="section-label" style={{ justifyContent: 'center' }}>Pricing</div>
          <h2 className="section-title">START FREE.<br />GO PRO.</h2>
          <div className="pricing-grid">
            <div className="price-card">
              <div className="price-plan">Free Tier</div>
              <div className="price-amount">$<span>0</span></div>
              <div className="price-period">forever free</div>
              <ul className="price-features">
                <li>10 messages per day</li><li>Full build generation</li><li>Compatibility checking</li>
                <li>Amazon affiliate links</li><li className="dim">Saved build history</li>
                <li className="dim">Price drop alerts</li><li className="dim">Priority responses</li>
              </ul>
              <Link href="/chat" className="price-btn outline">Start Building</Link>
            </div>
            <div className="price-card featured">
              <div className="price-badge">Most Popular</div>
              <div className="price-plan">Pro Builder</div>
              <div className="price-amount">$<span>5</span></div>
              <div className="price-period">per month</div>
              <ul className="price-features">
                <li>Unlimited messages</li><li>Full build generation</li><li>Compatibility checking</li>
                <li>Amazon affiliate links</li><li>Saved build history</li>
                <li>Price drop alerts</li><li>Priority responses</li>
              </ul>
              <Link href="/chat" className="price-btn filled">Go Pro →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="final-cta" style={{ position: 'relative', zIndex: 1 }}>
        <div className="final-cta-title">YOUR BUILD.<br /><span className="accent">30 SECONDS.</span></div>
        <p>Stop spending days on spreadsheets and forum posts. Let Zuuke spec your perfect PC right now — for free.</p>
        <Link href="/chat" className="btn-primary" style={{ fontSize: 15, padding: '18px 52px' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          Build My PC Now
        </Link>
      </section>

      <footer style={{ position: 'relative', zIndex: 1 }}>
        <div className="footer-logo">ZUUKE<span>.</span></div>
        <div className="footer-text">© 2026 Zuuke AI · All rights reserved</div>
        <div className="footer-links">
          <Link href="/about">About Us</Link>
          <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Affiliate Disclosure</a>
        </div>
      </footer>
    </>
  )
}
