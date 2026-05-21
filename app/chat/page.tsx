'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import BgCanvas from '@/components/BgCanvas'
import { createBrowserClient } from '@/lib/supabase'
import { marked } from 'marked'

const TAG = 'zuuke-20'
const GUEST_LIMIT = 5

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  streaming?: boolean
}

interface Chat {
  id: string
  title: string
  timestamp: Date
  messages: Message[]
}

interface UserStatus {
  name: string
  plan: 'free' | 'pro'
  messagesUsed: number
  messagesLimit: number
}

// ── Helpers ──────────────────────────────────────────────────────

function addLinks(html: string): string {
  const pats = [
    /\b(RTX\s*\d{4}(?:\s*(?:Super|Ti|XT|XTX))?)\b/gi,
    /\b(RX\s*\d{4}(?:\s*(?:XT|XTX|GRE))?)\b/gi,
    /\b(Ryzen\s*[359]\s*\d{4}[A-Z0-9]*)\b/gi,
    /\b(Core\s*i[357]-\d{4,5}[A-Z0-9]*)\b/gi,
    /\b(Corsair\s+RM\d+[ex]?)\b/gi,
  ]
  let r = html
  pats.forEach((re) => {
    r = r.replace(
      re,
      (m) =>
        `<a href="https://www.amazon.com/s?k=${encodeURIComponent(m.trim())}&tag=${TAG}" target="_blank" rel="noopener sponsored">${m}</a>`
    )
  })
  return r
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmt(d: Date | string): string {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function loadChats(): Chat[] | null {
  try {
    const saved = localStorage.getItem('zuuke-chats')
    if (!saved) return null
    const parsed = JSON.parse(saved)
    return parsed.map((c: Chat) => ({
      ...c,
      timestamp: new Date(c.timestamp),
      messages: c.messages.map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }))
  } catch {
    return null
  }
}

function saveChats(chats: Chat[]) {
  try {
    localStorage.setItem('zuuke-chats', JSON.stringify(chats))
  } catch { /* noop */ }
}

function getGuestCount(): number {
  try {
    return parseInt(localStorage.getItem('zuuke-guest-count') || '0', 10)
  } catch {
    return 0
  }
}

function bumpGuestCount(): number {
  const n = getGuestCount() + 1
  try { localStorage.setItem('zuuke-guest-count', String(n)) } catch { /* noop */ }
  return n
}

// ── Main ChatApp ──────────────────────────────────────────────────

function ChatApp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient()

  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null)
  const [isGuest, setIsGuest] = useState(true)
  const [guestCount, setGuestCount] = useState(0)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, 'up' | 'down'>>({})

  const streamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const currentChat = chats.find((c) => c.id === currentChatId)

  // Last AI message id (for per-message regenerate button)
  const lastAiMsgId = currentChat?.messages.reduce<string | null>(
    (acc, m) => (m.role === 'assistant' ? m.id : acc),
    null
  ) ?? null

  const scrollBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [])

  // Detect scroll-from-bottom to show "↓" button
  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const onScroll = () => {
      setShowScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [initialized])

  // Track mobile breakpoint + open sidebar on desktop by default
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(true)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Init: load auth session + chats
  useEffect(() => {
    setGuestCount(getGuestCount())
    supabase.auth.getSession().then(({ data: { session } }) => {
      const initialChats = loadChats() || [
        { id: '1', title: 'New Build Session', timestamp: new Date(), messages: [] },
      ]
      setChats(initialChats)
      setCurrentChatId(initialChats[0]?.id || '1')
      setInitialized(true)

      if (session) {
        setIsGuest(false)
        fetchUserStatus(session.access_token)
        if (searchParams.get('upgraded') === 'true') {
          window.history.replaceState({}, '', '/chat')
          setTimeout(() => fetchUserStatus(session.access_token), 1500)
        }
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchUserStatus(token?: string) {
    try {
      const t = token || (await supabase.auth.getSession()).data.session?.access_token
      if (!t) return
      const res = await fetch('/api/user-status', { headers: { Authorization: `Bearer ${t}` } })
      if (res.ok) setUserStatus(await res.json())
    } catch { /* noop */ }
  }

  async function getToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  function updateChats(updated: Chat[]) {
    setChats(updated)
    saveChats(updated)
  }

  function createNewChat() {
    if (isStreaming) stopStream()
    const c: Chat = {
      id: Date.now().toString(),
      title: 'New Build Session',
      timestamp: new Date(),
      messages: [],
    }
    updateChats([c, ...chats])
    setCurrentChatId(c.id)
    if (window.innerWidth <= 768) setSidebarOpen(false)
  }

  function selectChat(id: string) {
    if (isStreaming) stopStream()
    setCurrentChatId(id)
    if (window.innerWidth <= 768) setSidebarOpen(false)
  }

  function deleteChat(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (chats.length === 1) return
    const updated = chats.filter((c) => c.id !== id)
    updateChats(updated)
    if (currentChatId === id) setCurrentChatId(updated[0].id)
  }

  function stopStream() {
    streamReaderRef.current?.cancel()
    streamReaderRef.current = null
    setIsStreaming(false)
    setChats((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== currentChatId) return c
        return { ...c, messages: c.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)) }
      })
      saveChats(updated)
      return updated
    })
  }

  async function handleUpgrade() {
    if (isGuest) { setShowSignInModal(true); return }
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setIsGuest(true)
    setUserStatus(null)
    router.refresh()
  }

  // ── Copy message ──────────────────────────────────────────────

  async function copyMessage(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* noop */ }
  }

  // ── Thumb up/down ─────────────────────────────────────────────

  function thumbMessage(id: string, dir: 'up' | 'down') {
    setThumbs((prev) => {
      if (prev[id] === dir) {
        const n = { ...prev }
        delete n[id]
        return n
      }
      return { ...prev, [id]: dir }
    })
  }

  // ── Edit user message ─────────────────────────────────────────

  function editMessage(id: string) {
    if (!currentChat || isStreaming) return
    const msgIdx = currentChat.messages.findIndex((m) => m.id === id)
    if (msgIdx === -1) return
    const msg = currentChat.messages[msgIdx]
    if (inputRef.current) {
      inputRef.current.value = msg.content
      adjustHeight(inputRef.current)
      inputRef.current.focus()
    }
    // Remove this message and everything after
    const trimmed = currentChat.messages.slice(0, msgIdx)
    setChats((prev) => {
      const updated = prev.map((c) => (c.id === currentChatId ? { ...c, messages: trimmed } : c))
      saveChats(updated)
      return updated
    })
  }

  // ── Regenerate last AI response ───────────────────────────────

  async function regenerateLast() {
    if (!currentChat || isStreaming) return
    const msgs = currentChat.messages
    let lastUserIdx = -1
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx === -1) return
    const lastUser = msgs[lastUserIdx]
    // History = everything before the last user message
    const history = msgs.slice(0, lastUserIdx)
    await sendMessageWithText(lastUser.content, history)
  }

  // ── Core send logic ───────────────────────────────────────────

  async function sendMessage(overrideText?: string) {
    const input = inputRef.current
    const msg = overrideText || input?.value.trim() || ''
    if (!msg || isStreaming) return

    // Guest: check limit before sending
    if (isGuest) {
      const count = getGuestCount()
      if (count >= GUEST_LIMIT) {
        setShowSignInModal(true)
        return
      }
    }

    if (input && !overrideText) {
      input.value = ''
      input.style.height = '52px'
    }

    const currentHistory = chats.find((c) => c.id === currentChatId)?.messages || []
    await sendMessageWithText(msg, currentHistory)
  }

  async function sendMessageWithText(msg: string, history: Message[]) {
    const token = await getToken()

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    }
    const asstId = (Date.now() + 1).toString()
    const asstMsg: Message = {
      id: asstId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true,
    }

    setChats((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== currentChatId) return c
        const newMsgs = [...history, userMsg, asstMsg]
        const title = history.length === 0 ? msg.slice(0, 44) : c.title
        return { ...c, title, messages: newMsgs }
      })
      saveChats(updated)
      return updated
    })

    scrollBottom()
    setIsStreaming(true)

    // Increment guest counter
    if (isGuest) {
      const newCount = bumpGuestCount()
      setGuestCount(newCount)
    }

    try {
      const historyMsgs = [...history, userMsg]
        .filter((m) => !m.streaming)
        .map((m) => ({ role: m.role, content: m.content }))

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: historyMsgs }),
      })

      if (res.status === 429) {
        setChats((prev) => {
          const updated = prev.map((c) => {
            if (c.id !== currentChatId) return c
            return { ...c, messages: c.messages.filter((m) => m.id !== asstId) }
          })
          saveChats(updated)
          return updated
        })
        setIsStreaming(false)
        setShowLimitModal(true)
        return
      }
      if (!res.ok) throw new Error('Server error')

      const reader = res.body!.getReader()
      streamReaderRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''
      let rawText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) continue
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text !== undefined) {
                rawText += data.text
                setChats((prev) => {
                  const updated = prev.map((c) => {
                    if (c.id !== currentChatId) return c
                    return {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === asstId ? { ...m, content: rawText, streaming: true } : m
                      ),
                    }
                  })
                  return updated
                })
                scrollBottom()
              }
            } catch { /* partial line */ }
          }
          if (line === 'event: done' || line === 'event: error') {
            setChats((prev) => {
              const updated = prev.map((c) => {
                if (c.id !== currentChatId) return c
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === asstId ? { ...m, streaming: false } : m
                  ),
                }
              })
              saveChats(updated)
              return updated
            })
            setIsStreaming(false)
            streamReaderRef.current = null
            if (!isGuest) fetchUserStatus()
          }
        }
      }

      // Final cleanup
      setChats((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== currentChatId) return c
          return {
            ...c,
            messages: c.messages.map((m) => (m.id === asstId ? { ...m, streaming: false } : m)),
          }
        })
        saveChats(updated)
        return updated
      })
      if (!isGuest) fetchUserStatus()
    } catch {
      setChats((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== currentChatId) return c
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === asstId
                ? {
                    ...m,
                    content: 'Could not connect to the server. Please check your connection and try again.',
                    streaming: false,
                  }
                : m
            ),
          }
        })
        saveChats(updated)
        return updated
      })
    } finally {
      setIsStreaming(false)
      streamReaderRef.current = null
      scrollBottom()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) stopStream()
      else sendMessage()
    }
  }

  function adjustHeight(el: HTMLTextAreaElement) {
    el.style.height = '52px'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  // ── Sidebar chat grouping ─────────────────────────────────────

  const filteredChats = searchQuery.trim()
    ? chats.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : chats

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const todayChats = filteredChats.filter((c) => new Date(c.timestamp) >= todayStart)
  const yesterdayChats = filteredChats.filter(
    (c) => new Date(c.timestamp) >= yesterdayStart && new Date(c.timestamp) < todayStart
  )
  const olderChats = filteredChats.filter((c) => new Date(c.timestamp) < yesterdayStart)

  const guestRemaining = Math.max(0, GUEST_LIMIT - guestCount)

  if (!initialized) return null

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="container" style={{ display: 'flex', height: '100vh', position: 'relative', zIndex: 1 }}>

      {/* Mobile sidebar overlay — only on narrow viewports */}
      {sidebarOpen && isMobile && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar${sidebarOpen ? '' : ' mobile-hidden'}`} id="sidebar">
        <div className="sidebar-header">
          <Link href="/" className="sidebar-logo">
            <div className="sidebar-logo-mark">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="3" width="20" height="14" rx="1" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <div>
              <div className="sidebar-logo-name">ZUUKE<span>.</span></div>
              <div className="sidebar-logo-sub">PC Build AI</div>
            </div>
          </Link>
          <button className="new-chat-btn" onClick={createNewChat}>
            <span className="new-chat-icon">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            New Build Session
          </button>
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="chat-history">
          {([['Today', todayChats], ['Yesterday', yesterdayChats], ['Earlier', olderChats]] as [string, Chat[]][]).map(
            ([label, list]) => {
              if (!list.length) return null
              return (
                <div key={label}>
                  <div className="history-label">{label}</div>
                  {list.map((c) => (
                    <div
                      key={c.id}
                      className={`chat-item${c.id === currentChatId ? ' active' : ''}`}
                      onClick={() => selectChat(c.id)}
                    >
                      {c.title}
                      {chats.length > 1 && (
                        <button className="delete-btn" onClick={(e) => deleteChat(e, c.id)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          )}
          {filteredChats.length === 0 && searchQuery && (
            <div style={{ padding: '16px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--mist)', letterSpacing: '0.06em' }}>
              No sessions found
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="status-bar">
            <div className="status-dot" />
            <span className="status-label">System Online</span>
          </div>

          <div id="usageSection">
            {isGuest ? (
              <div className="guest-info">
                <div className="guest-info-label">Guest Session</div>
                <div className="guest-bar-wrap">
                  <div className="guest-bar-label">
                    <span>Free Messages</span>
                    <span>{guestCount} / {GUEST_LIMIT}</span>
                  </div>
                  <div className="guest-bar-track">
                    <div
                      className={`guest-bar-fill${guestCount >= GUEST_LIMIT - 1 ? ' warn' : ''}`}
                      style={{ width: `${Math.min((guestCount / GUEST_LIMIT) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <button className="guest-signin-btn" onClick={() => setShowSignInModal(true)}>
                  Sign In / Create Account →
                </button>
              </div>
            ) : userStatus ? (
              userStatus.plan === 'pro' ? (
                <>
                  <div className="pro-badge">★ PRO — Unlimited</div>
                  <div className="user-name">{userStatus.name}</div>
                </>
              ) : (
                <>
                  <div className="user-name">
                    Signed in as <strong style={{ color: 'var(--white)' }}>{userStatus.name}</strong>
                  </div>
                  <div className="usage-bar-wrap">
                    <div className="usage-label">
                      <span>Free Plan</span>
                      {userStatus.messagesUsed}/{userStatus.messagesLimit} today
                    </div>
                    <div className="usage-track">
                      <div
                        className={`usage-fill${Math.round((userStatus.messagesUsed / userStatus.messagesLimit) * 100) >= 80 ? ' warn' : ''}`}
                        style={{ width: `${Math.round((userStatus.messagesUsed / userStatus.messagesLimit) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <button className="upgrade-btn" onClick={handleUpgrade}>↑ Upgrade to Pro</button>
                </>
              )
            ) : null}
          </div>

          <Link href="/" className="back-link">Back to Home</Link>
          {!isGuest && (
            <button className="logout-link" onClick={handleLogout}>← Sign Out</button>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main-content">
        <div className="top-bar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="top-bar-title">{currentChat?.title || 'New Build Session'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="top-bar-badge">PC Build Mode</div>
            {isGuest ? (
              <button
                onClick={() => setShowSignInModal(true)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--cyan)',
                  background: 'transparent',
                  border: '1px solid rgba(0,212,255,0.35)',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Sign In
              </button>
            ) : userStatus?.name ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mist)' }}>
                Hi, <span style={{ color: 'var(--cyan)' }}>{userStatus.name}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Messages area */}
        <div className="messages-container" ref={messagesContainerRef}>
          {!currentChat?.messages.length && (
            <div className="empty-state">
              <div className="empty-content">
                {/* Guest limit reached — show sign-in CTA inline instead of blocking modal */}
                {isGuest && guestCount >= GUEST_LIMIT ? (
                  <>
                    <div className="empty-badge" style={{ borderColor: 'rgba(255,111,0,0.4)', color: 'var(--orange)' }}>Guest Limit Reached</div>
                    <div className="empty-title">
                      <span className="t1">KEEP</span>
                      <span className="t2">BUILDING.</span>
                    </div>
                    <p className="empty-sub">
                      You&apos;ve used your {GUEST_LIMIT} free guest messages. Create a free account for <strong style={{ color: 'var(--white)' }}>10 messages per day</strong> — or go Pro for unlimited.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340, margin: '0 auto' }}>
                      <Link href="/auth?mode=signup" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        Create Free Account
                      </Link>
                      <Link href="/auth?mode=login" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mist)', textAlign: 'center', textDecoration: 'none' }}>
                        Already have an account? Sign In →
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="empty-badge">AI Build Assistant · Ready</div>
                    <div className="empty-title">
                      <span className="t1">SPEC YOUR</span>
                      <span className="t2">PERFECT RIG</span>
                    </div>
                    <p className="empty-sub">
                      Tell me your budget and what you&apos;ll use it for. I&apos;ll handle every component — compatible, optimized, and within budget.
                    </p>
                    {isGuest && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--mist)', marginBottom: 24, textTransform: 'uppercase' }}>
                        {GUEST_LIMIT} free messages · No account needed
                      </p>
                    )}
                    <div className="suggestions">
                      {[
                        { icon: '🎮', title: 'FPS Gaming Build', text: '$1,200 · 1080p high FPS', prompt: 'Build me a gaming PC for $1,200. I play FPS games at 1080p and want the highest possible FPS.' },
                        { icon: '🎬', title: 'Video Editing Rig', text: '$2,000 · 4K editing powerhouse', prompt: 'I need a PC for 4K video editing in Premiere Pro and DaVinci Resolve. Budget is $2,000.' },
                        { icon: '⚡', title: 'Budget Starter', text: 'Under $600 · entry-level gaming', prompt: 'Build me a budget gaming PC for under $600. I want to play Fortnite and Minecraft.' },
                        { icon: '🔧', title: 'Upgrade Advisor', text: 'Analyze your current rig', prompt: 'I have an i7-9700K and RTX 2070. What should I upgrade first to improve gaming performance?' },
                      ].map((s) => (
                        <div key={s.title} className="sug-card" onClick={() => sendMessage(s.prompt)}>
                          <span className="sug-icon">{s.icon}</span>
                          <div className="sug-title">{s.title}</div>
                          <div className="sug-text">{s.text}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div>
            {currentChat?.messages.map((m, idx) => (
              <MessageRow
                key={m.id}
                message={m}
                isLastAi={m.role === 'assistant' && m.id === lastAiMsgId}
                copiedId={copiedId}
                thumbs={thumbs}
                isStreaming={isStreaming}
                onCopy={() => copyMessage(m.id, m.content)}
                onRegenerate={!isStreaming ? regenerateLast : undefined}
                onEdit={m.role === 'user' && !isStreaming ? () => editMessage(m.id) : undefined}
                onThumbUp={() => thumbMessage(m.id, 'up')}
                onThumbDown={() => thumbMessage(m.id, 'down')}
              />
            ))}

            {/* Typing indicator */}
            {isStreaming && currentChat?.messages[currentChat.messages.length - 1]?.content === '' && (
              <div className="typing-indicator">
                <div className="msg-inner">
                  <div
                    className="msg-avatar"
                    style={{
                      background: 'linear-gradient(135deg,#0099cc,#00d4ff)',
                      color: '#020305',
                      clipPath: 'polygon(4px 0%,100% 0%,calc(100% - 4px) 100%,0% 100%)',
                      boxShadow: '0 4px 14px rgba(0,212,255,.2)',
                    }}
                  >
                    AI
                  </div>
                  <div className="msg-body">
                    <div className="msg-meta">
                      <span className="msg-name" style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--cyan)', letterSpacing: '.06em' }}>
                        Zuuke
                      </span>
                      <span className="msg-badge">Thinking</span>
                    </div>
                    <div className="typing-dots">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scroll-to-bottom floating button */}
        <button
          className={`scroll-bottom-btn${showScrollBottom ? ' visible' : ''}`}
          onClick={scrollBottom}
          aria-label="Scroll to bottom"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Input area */}
        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              className="input-field"
              placeholder="Describe your budget, use case, and any parts you already own…"
              rows={1}
              onKeyDown={handleKeyDown}
              onInput={(e) => adjustHeight(e.currentTarget)}
            />
            <button
              className={`send-btn${isStreaming ? ' stop' : ''}`}
              onClick={() => {
                if (isGuest && guestCount >= GUEST_LIMIT) { setShowSignInModal(true); return }
                if (isStreaming) stopStream()
                else sendMessage()
              }}
            >
              {isStreaming ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
          <div className="input-footer">
            {isGuest && guestCount > 0 ? (
              <span>
                {guestRemaining} free message{guestRemaining !== 1 ? 's' : ''} left ·{' '}
                <button
                  onClick={() => setShowSignInModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', padding: 0 }}
                >
                  Sign in for more
                </button>
              </span>
            ) : (
              'Zuuke may make mistakes · Always verify compatibility before purchasing'
            )}
          </div>
        </div>
      </main>

      {/* ── Daily limit modal (logged-in free users) ── */}
      {showLimitModal && (
        <div className="limit-modal show">
          <div className="limit-box">
            <div className="limit-title">DAILY LIMIT REACHED</div>
            <div className="limit-sub">
              You&apos;ve used all 10 free messages today.<br />
              Upgrade to Pro for unlimited access — just $5/month.
            </div>
            <button className="limit-upgrade-btn" onClick={handleUpgrade}>Upgrade to Pro — $5/month</button>
            <button className="limit-dismiss" onClick={() => setShowLimitModal(false)}>Maybe later</button>
          </div>
        </div>
      )}

      {/* ── Sign-in modal (guest limit) ── */}
      {showSignInModal && (
        <div className="signin-modal show">
          <div className="signin-box">
            <button className="signin-close" onClick={() => setShowSignInModal(false)}>✕</button>
            <div className="signin-box-eyebrow">
              {guestCount >= GUEST_LIMIT ? 'Guest Limit Reached' : 'Save Your Build History'}
            </div>
            <div className="signin-box-title">
              KEEP<br /><span>BUILDING.</span>
            </div>
            <p className="signin-box-sub">
              {guestCount >= GUEST_LIMIT ? (
                <>You&apos;ve used your <strong>{GUEST_LIMIT} free guest messages</strong>. Create a free account to get <strong>10 messages per day</strong> — or go Pro for unlimited.</>
              ) : (
                <>Sign in to save your build history, get more messages, and unlock Pro features.</>
              )}
            </p>
            <div className="signin-btns">
              <Link href="/auth?mode=signup" className="signin-btn primary">
                Create Free Account →
              </Link>
              <Link href="/auth?mode=login" className="signin-btn secondary">
                Sign In to Existing Account
              </Link>
              <button className="signin-btn ghost" onClick={() => setShowSignInModal(false)}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MessageRow ────────────────────────────────────────────────────

interface MessageRowProps {
  message: Message
  isLastAi: boolean
  copiedId: string | null
  thumbs: Record<string, 'up' | 'down'>
  isStreaming: boolean
  onCopy: () => void
  onRegenerate?: () => void
  onEdit?: () => void
  onThumbUp: () => void
  onThumbDown: () => void
}

function MessageRow({
  message: m,
  isLastAi,
  copiedId,
  thumbs,
  isStreaming,
  onCopy,
  onRegenerate,
  onEdit,
  onThumbUp,
  onThumbDown,
}: MessageRowProps) {
  const renderedHTML =
    m.role === 'assistant'
      ? addLinks(marked.parse(m.content) as string) +
        (m.streaming ? '<span class="stream-cursor"></span>' : '')
      : escapeHTML(m.content)

  return (
    <div className={`message ${m.role}${m.streaming ? ' streaming' : ''}`}>
      <div className="msg-inner">
        <div className="msg-avatar">{m.role === 'user' ? 'YOU' : 'AI'}</div>
        <div className="msg-body">
          <div className="msg-meta">
            <span className="msg-name">{m.role === 'user' ? 'You' : 'Zuuke'}</span>
            {m.role === 'assistant' && <span className="msg-badge">PC Expert</span>}
            <span className="msg-time">{fmt(m.timestamp)}</span>
          </div>
          <div className="msg-text" dangerouslySetInnerHTML={{ __html: renderedHTML }} />

          {/* Action buttons — hidden until hover (always visible on touch) */}
          {!m.streaming && (
            <div className="msg-actions">
              {/* Copy */}
              <button
                className={`msg-action-btn${copiedId === m.id ? ' copied' : ''}`}
                onClick={onCopy}
                title="Copy"
              >
                {copiedId === m.id ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </button>

              {/* AI-only actions */}
              {m.role === 'assistant' && (
                <>
                  {/* Retry — only on last AI message */}
                  {isLastAi && onRegenerate && (
                    <button
                      className="msg-action-btn"
                      onClick={onRegenerate}
                      title="Regenerate response"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 .49-3.7" />
                      </svg>
                      Retry
                    </button>
                  )}

                  {/* Thumb up */}
                  <button
                    className={`msg-action-btn${thumbs[m.id] === 'up' ? ' active' : ''}`}
                    onClick={onThumbUp}
                    title="Good response"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill={thumbs[m.id] === 'up' ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
                      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                  </button>

                  {/* Thumb down */}
                  <button
                    className={`msg-action-btn${thumbs[m.id] === 'down' ? ' active' : ''}`}
                    onClick={onThumbDown}
                    title="Bad response"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill={thumbs[m.id] === 'down' ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z" />
                      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                    </svg>
                  </button>
                </>
              )}

              {/* User edit */}
              {m.role === 'user' && onEdit && (
                <button className="msg-action-btn" onClick={onEdit} title="Edit message">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page wrapper ───────────────────────────────────────────────────

export default function ChatPage() {
  return (
    <>
      <BgCanvas opacity={0.35} particleCount={80} connectDistance={110} />
      <Suspense>
        <ChatApp />
      </Suspense>
    </>
  )
}
