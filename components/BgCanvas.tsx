'use client'

import { useEffect, useRef } from 'react'

interface Props {
  opacity?: number
  particleCount?: number
  connectDistance?: number
}

export default function BgCanvas({ opacity = 0.5, particleCount = 80, connectDistance = 110 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0, H = 0
    let animId: number

    interface Particle {
      x: number; y: number; vx: number; vy: number
      r: number; a: number; ph: number
      reset(): void; update(): void; draw(): void
    }

    const particles: Particle[] = []

    const resize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    class P implements Particle {
      x = 0; y = 0; vx = 0; vy = 0; r = 0; a = 0; ph = 0
      constructor() { this.reset() }
      reset() {
        this.x = Math.random() * W; this.y = Math.random() * H
        this.vx = (Math.random() - 0.5) * 0.25; this.vy = (Math.random() - 0.5) * 0.25
        this.r = Math.random() * 1.2 + 0.3; this.a = Math.random() * 0.4 + 0.08
        this.ph = Math.random() * Math.PI * 2
      }
      update() {
        this.x += this.vx; this.y += this.vy; this.ph += 0.018
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset()
      }
      draw() {
        ctx!.beginPath()
        ctx!.arc(this.x, this.y, this.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(0,212,255,${this.a * (0.5 + Math.sin(this.ph) * 0.5)})`
        ctx!.fill()
      }
    }

    for (let i = 0; i < particleCount; i++) particles.push(new P())

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(26,37,53,0.5)'
      ctx.lineWidth = 0.4
      for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    }

    const connect = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < connectDistance) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(0,212,255,${0.1 * (1 - d / connectDistance)})`
            ctx.lineWidth = 0.4
            ctx.stroke()
          }
        }
      }
    }

    const loop = () => {
      ctx.clearRect(0, 0, W, H)
      drawGrid()
      particles.forEach(p => { p.update(); p.draw() })
      connect()
      animId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animId)
    }
  }, [particleCount, connectDistance])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, opacity, pointerEvents: 'none' }}
    />
  )
}
