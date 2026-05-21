'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import BgCanvas from '@/components/BgCanvas'

export default function AboutPage() {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle('scrolled', window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.15 }
    )
    document.querySelectorAll('.founder-card,.mission-quote').forEach((el) => observer.observe(el))

    const valObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.querySelectorAll('.value-item').forEach((el, i) => {
              setTimeout(() => el.classList.add('visible'), i * 100)
            })
          }
        })
      },
      { threshold: 0.2 }
    )
    const mv = document.querySelector('.mission-values')
    if (mv) valObs.observe(mv)

    return () => { observer.disconnect(); valObs.disconnect() }
  }, [])

  return (
    <>
      <BgCanvas opacity={0.4} particleCount={80} connectDistance={100} />

      <nav ref={navRef} className="nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="2" y="3" width="20" height="14" rx="1" /><path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <span className="nav-wordmark">ZUUKE<span>.</span></span>
        </Link>
        <div className="nav-links">
          <Link href="/#how-it-works">How It Works</Link>
          <Link href="/#features">Features</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/about" className="active">About Us</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/auth?mode=login" className="nav-login">
            Log In
          </Link>
          <Link href="/chat" className="nav-cta"><span>Start Building →</span></Link>
        </div>
      </nav>

      <div className="page" style={{ position: 'relative', zIndex: 1, paddingTop: 100 }}>

        {/* HERO */}
        <section className="about-hero">
          <div className="about-eyebrow">Our Story · Two Builders · One Vision</div>
          <div className="about-title">
            <span className="t1">BUILT BY</span>
            <span className="t2">STUDENTS</span>
            <span className="t3">FOR EVERYONE</span>
          </div>
          <p className="about-lead">
            Zuuke was founded by two Computer Science students at Florida International University who believed that building a PC should not require hours of research, spreadsheets, or prior technical knowledge. They set out to change that.
          </p>
        </section>

        {/* ORIGIN STORY */}
        <section className="story-section">
          <div className="section-label">Origin</div>
          <h2 className="section-title">HOW ZUUKE<br />CAME TO LIFE</h2>

          <div className="story-block">
            <div className="story-year">The Problem · Early 2025</div>
            <div className="story-heading">We Felt the Pain Firsthand</div>
            <p className="story-text">
              Like thousands of students, we wanted to build our own PCs. But the process was <strong>overwhelming</strong> — dozens of browser tabs, Reddit threads with conflicting advice, spreadsheets to track compatibility, and still the nagging feeling that we&apos;d get something wrong. We spent weeks researching what should have taken hours.
            </p>
          </div>

          <div className="story-block orange-dot">
            <div className="story-year">The Idea · Mid 2025</div>
            <div className="story-heading">What If AI Could Do This?</div>
            <p className="story-text">
              We were taking a CS elective when the idea clicked. <strong>What if someone could just describe what they wanted — in plain English — and get a complete, compatible, optimized build back instantly?</strong> No spreadsheets. No forum-diving. No fear of making an expensive mistake. We started building that weekend.
            </p>
          </div>

          <div className="story-block">
            <div className="story-year">The Build · Late 2025</div>
            <div className="story-heading">Two Students, Zero Budget, One Mission</div>
            <p className="story-text">
              With no funding, no team, and final exams looming, we built Zuuke from scratch — late nights, campus coffee shops, and more debugging sessions than we&apos;d like to admit. Every design decision, every line of code, every prompt tweak was <strong>done by the two of us</strong>. This is our project, our product, and our story.
            </p>
          </div>

          <div className="story-block orange-dot">
            <div className="story-year">Today · 2026</div>
            <div className="story-heading">A Real Product. Real Users. Real Impact.</div>
            <p className="story-text">
              Zuuke is live, helping people build better PCs faster than ever before. We&apos;re still students. We&apos;re still learning. But we&apos;re <strong>shipping</strong> — and we&apos;re just getting started.
            </p>
          </div>
        </section>

        {/* FOUNDERS */}
        <section className="founders-section">
          <div className="founders-inner">
            <div className="section-label">The Team</div>
            <h2 className="section-title">THE PEOPLE<br />BEHIND ZUUKE</h2>
            <div className="founders-grid">

              <div className="founder-card">
                <div className="founder-avatar"><span className="initials">YP</span></div>
                <div className="founder-role">Co-Founder · CEO</div>
                <div className="founder-name">Yash Patel</div>
                <div className="founder-school">Florida International University</div>
                <p className="founder-bio">
                  Yash is a Computer Science student at Florida International University with a passion for building products that solve real problems. He leads Zuuke&apos;s product strategy and user experience, driven by a simple belief: that powerful technology should be accessible to everyone, regardless of their technical background.
                  <br /><br />
                  Zuuke started as his frustration and became his mission.
                </p>
                <div className="founder-tags">
                  <span className="tag">Product</span>
                  <span className="tag">Full-Stack</span>
                  <span className="tag">Vision</span>
                </div>
                <a
                  href="https://www.linkedin.com/in/yashpatel2006/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="founder-linkedin"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
                  </svg>
                  linkedin.com/in/yashpatel2006
                </a>
              </div>

              <div className="founder-card orange">
                <div className="founder-avatar"><span className="initials">TN</span></div>
                <div className="founder-role">Co-Founder · CTO</div>
                <div className="founder-name">Tai Nguyen</div>
                <div className="founder-school">Florida International University</div>
                <p className="founder-bio">
                  Tai is a Computer Science student at Florida International University who architected and built the technical foundation of Zuuke from the ground up. From AI integration to real-time streaming infrastructure, he turns ambitious ideas into reliable, scalable products.
                  <br /><br />
                  He believes that great engineering is what separates a good idea from a great product.
                </p>
                <div className="founder-tags">
                  <span className="tag">Backend</span>
                  <span className="tag">AI / LLMs</span>
                  <span className="tag">Systems</span>
                </div>
                <a
                  href="https://www.linkedin.com/in/tai-nguyen-97a48336b/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="founder-linkedin orange"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
                  </svg>
                  linkedin.com/in/tai-nguyen-97a48336b
                </a>
              </div>

            </div>
          </div>
        </section>

        {/* MISSION & VALUES */}
        <section className="mission-section">
          <div className="section-label">Mission</div>
          <h2 className="section-title">WHAT WE<br />STAND FOR</h2>

          <div className="mission-quote">
            <p>Building a PC shouldn&apos;t require a computer science degree. It should require knowing what you want to do with it.</p>
            <cite>— The Zuuke Team</cite>
          </div>

          <div className="mission-values">
            {[
              { num: '01', title: 'Radical Simplicity', text: 'Anyone should be able to build a great PC. We remove every barrier between your budget and your perfect rig.' },
              { num: '02', title: 'Genuine Accuracy', text: "We only recommend what we'd build ourselves. Compatibility, value, and performance — no compromises." },
              { num: '03', title: 'Student Spirit', text: "We know what it's like to have a tight budget and big ambitions. That perspective drives every decision we make." },
            ].map((v) => (
              <div key={v.num} className="value-item">
                <div className="value-num">{v.num}</div>
                <div className="value-title">{v.title}</div>
                <div className="value-text">{v.text}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="about-cta">
          <div className="cta-title">LET&apos;S BUILD<br /><span className="accent">SOMETHING.</span></div>
          <p className="cta-sub">Try Zuuke free — no account needed to start. See what two students built for you.</p>
          <Link href="/chat" className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Get Started Free
          </Link>
        </section>

      </div>

      <footer style={{ position: 'relative', zIndex: 1 }}>
        <div className="footer-logo">ZUUKE<span>.</span></div>
        <div className="footer-text">© 2026 Zuuke AI · All rights reserved</div>
        <div className="footer-links">
          <Link href="/about">About Us</Link>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Affiliate Disclosure</a>
        </div>
      </footer>
    </>
  )
}
