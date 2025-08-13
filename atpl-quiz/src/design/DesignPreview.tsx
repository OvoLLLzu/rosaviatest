import React, { useEffect } from 'react'
import './design.css'

type Theme = 'dark' | 'light'

type DesignProps = {
  screen: 'home' | 'test' | 'finish'
  theme: Theme
  transparentBg: boolean
}

function useBodyTheme(theme: Theme, transparentBg: boolean) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (transparentBg) {
      document.body.classList.add('bg-transparent')
    } else {
      document.body.classList.remove('bg-transparent')
    }
    return () => {
      document.body.classList.remove('bg-transparent')
    }
  }, [theme, transparentBg])
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card ${className}`}>
      {children}
    </div>
  )
}

function HomeScreen() {
  return (
    <div className="screen mobile">
      <div className="bg-clouds" />
      <div className="topbar">
        <GlassCard className="mini-stats">
          <div>
            <span className="label">Время</span>
            <span className="value">01:12:45</span>
          </div>
          <div>
            <span className="label">Точность</span>
            <span className="value">78%</span>
          </div>
        </GlassCard>
      </div>
      <div className="center-logo">
        <div className="logo-plane">
          <svg width="164" height="164" viewBox="0 0 164 164">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1A3A6C" />
                <stop offset="100%" stopColor="#4A6FA5" />
              </linearGradient>
            </defs>
            <circle cx="82" cy="82" r="78" fill="url(#g1)" opacity="0.15" />
            <path d="M82 20 L98 82 L82 76 L66 82 Z" fill="#fff" opacity="0.9" />
            <path d="M82 76 L120 96 L82 90 L44 96 Z" fill="#fff" opacity="0.9" />
          </svg>
          <div className="brand">ATPL TEST</div>
        </div>
      </div>
      <div className="actions-col">
        <button className="btn primary breath">Начать тест</button>
        <button className="btn danger subtle">Сбросить прогресс</button>
        <div className="stages">
          <div className="stage" />
          <div className="stage" />
          <div className="stage active" />
          <div className="stage" />
        </div>
      </div>
    </div>
  )
}

function TestScreen() {
  return (
    <div className="screen mobile">
      <div className="bg-clouds" />
      <div className="topbar row">
        <GlassCard className="altimeter">
          <div className="alt-label">Осталось</div>
          <div className="alt-value">12/744</div>
        </GlassCard>
        <GlassCard className="timer">
          <svg viewBox="0 0 120 120" className="timer-svg">
            <circle cx="60" cy="60" r="52" className="timer-bg" />
            <circle cx="60" cy="60" r="52" className="timer-fg" />
            <text x="60" y="66" textAnchor="middle" className="timer-text">00:30</text>
          </svg>
        </GlassCard>
      </div>
      <GlassCard className="question-card glass">
        <div className="q-marker">
          <span className="pin" />
          <span className="q-num">736</span>
        </div>
        <div className="q-text">Для каких целей подается уведомление в классе G?</div>
      </GlassCard>
      <div className="answers-col">
        <button className="answer-btn">
          <span className="label">A</span>
          <span>для получения диспетчерского разрешения;</span>
        </button>
        <button className="answer-btn">
          <span className="label">B</span>
          <span>для получения аэронавигационной и метеорологической информации;</span>
        </button>
        <button className="answer-btn correct animate-ok">
          <span className="label">C</span>
          <span>для получения полетно-информционного обслуживания и аварийного оповещения;</span>
          <span className="ico ok" />
        </button>
      </div>
      <div className="bottom">
        <button className="btn primary glow">Далее</button>
        <div className="route">
          <div className="dot" />
          <div className="line" />
          <div className="dot" />
          <div className="line" />
          <div className="dot active" />
        </div>
      </div>
    </div>
  )
}

function FinishScreen() {
  return (
    <div className="screen mobile">
      <div className="bg-clouds" />
      <div className="landing">
        <div className="runway" />
        <div className="plane-anim" />
      </div>
      <div className="finish-title">Тест завершен!</div>
      <div className="stats-grid">
        <GlassCard className="stat big-clock">
          <div className="clock-face">
            <div className="hand h1" />
            <div className="hand h2" />
            <div className="center" />
          </div>
          <div className="clock-text">01:24:12</div>
        </GlassCard>
        <GlassCard className="stat path">
          <div className="path-chart">
            <svg viewBox="0 0 240 80">
              <polyline points="0,60 40,50 80,55 120,35 160,30 200,20 240,25" className="path-line" />
              <circle cx="0" cy="60" r="3" className="path-dot" />
              <circle cx="120" cy="35" r="3" className="path-dot" />
              <circle cx="240" cy="25" r="3" className="path-dot" />
            </svg>
          </div>
          <div className="path-label">Траектория успеваемости</div>
        </GlassCard>
        <GlassCard className="stat report">
          <div className="report-row"><span>Навигация</span><span>82%</span></div>
          <div className="report-row"><span>Метео</span><span>76%</span></div>
          <div className="report-row"><span>Правила</span><span>88%</span></div>
        </GlassCard>
      </div>
      <div className="finish-actions">
        <button className="btn primary with-icon">Новый тест</button>
        <button className="btn secondary with-icon">Статистика</button>
      </div>
    </div>
  )
}

export default function DesignPreview(props?: Partial<DesignProps>) {
  const url = new URL(window.location.href)
  const screen = (props?.screen || (url.searchParams.get('design') as any) || 'home') as DesignProps['screen']
  const theme = (props?.theme || (url.searchParams.get('theme') as any) || 'dark') as Theme
  const transparentBg = props?.transparentBg ?? (url.searchParams.get('bg') === 'transparent')

  useBodyTheme(theme, transparentBg)

  return (
    <div className={`design-root theme-${theme}`}>
      {screen === 'home' && <HomeScreen />}
      {screen === 'test' && <TestScreen />}
      {screen === 'finish' && <FinishScreen />}
    </div>
  )
}