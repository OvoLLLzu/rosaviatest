import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './design/design.css'

// Data structures
export type AnswerOption = {
  id: number
  text: string
  isCorrect: boolean
}

export type Question = {
  id: number
  text: string
  options: AnswerOption[]
}

export type SessionQuestionState = {
  questionId: number
  consecutiveCorrect: number
  isExcluded: boolean
}

type SessionState = {
  questionStates: Record<number, SessionQuestionState>
  currentQuestionId: number | null
}

type StatsState = {
  totalAnswers: number
  correctAnswers: number
}

const STORAGE_KEYS = {
  session: 'atpl-quiz-session-v1',
  timerStart: 'atpl-quiz-timer-start-v1',
  stats: 'atpl-quiz-stats-v1',
}

function parseQuestions(raw: string): Question[] {
  const blocks = raw
    .split(/\n\s*_{35,}\s*\n/g)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)

  const questions: Question[] = []
  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length < 4) continue

    let questionLineIndex = 0
    while (
      questionLineIndex < Math.min(3, lines.length) &&
      !/^\d+\s*\./.test(lines[questionLineIndex])
    ) {
      questionLineIndex++
    }
    if (questionLineIndex >= lines.length) continue

    const questionLine = lines[questionLineIndex]
    const idMatch = questionLine.match(/^(\d+)\s*\./)
    if (!idMatch) continue
    const qid = Number(idMatch[1])
    const qtext = questionLine.replace(/^(\d+)\s*\.?\s*/, '').trim()

    const optionLines = lines
      .slice(questionLineIndex + 1)
      .filter((l) => l.length > 0)
      .slice(0, 3)

    if (optionLines.length !== 3) continue

    const options: AnswerOption[] = optionLines.map((line, idx) => {
      const isCorrect = /^\*\s*/.test(line)
      const text = line.replace(/^\*\s*/, '')
      return { id: idx, text, isCorrect }
    })

    questions.push({ id: qid, text: qtext, options })
  }

  const seen = new Set<number>()
  const deduped: Question[] = []
  for (const q of questions) {
    if (!seen.has(q.id)) {
      seen.add(q.id)
      deduped.push(q)
    }
  }
  return deduped
}

function usePersistentTimer() {
  const [elapsedMs, setElapsedMs] = useState<number>(0)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    let start = localStorage.getItem(STORAGE_KEYS.timerStart)
    let startMs = start ? Number(start) : NaN
    if (!start || Number.isNaN(startMs)) {
      startMs = Date.now()
      localStorage.setItem(STORAGE_KEYS.timerStart, String(startMs))
    }

    const update = () => {
      setElapsedMs(Date.now() - startMs)
    }
    update()
    intervalRef.current = window.setInterval(update, 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  const hh = Math.floor(elapsedMs / 3600000)
  const mm = Math.floor((elapsedMs % 3600000) / 60000)
  const ss = Math.floor((elapsedMs % 60000) / 1000)
  const formatted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`

  const reset = () => {
    const now = Date.now()
    localStorage.setItem(STORAGE_KEYS.timerStart, String(now))
    setElapsedMs(0)
  }

  return { elapsedMs, formatted, reset }
}

function App() {
  const [raw, setRaw] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load questions.txt
  useEffect(() => {
    fetch('questions.txt')
      .then((r) => r.text())
      .then(setRaw)
      .catch((e) => setError(String(e)))
  }, [])

  const allQuestions = useMemo(() => (raw ? parseQuestions(raw) : []), [raw])

  const { formatted: timeFormatted, elapsedMs, reset: resetTimer } = usePersistentTimer()

  const [session, setSession] = useState<SessionState>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.session)
    if (stored) {
      try {
        return JSON.parse(stored) as SessionState
      } catch {}
    }
    return { questionStates: {}, currentQuestionId: null }
  })

  const [stats, setStats] = useState<StatsState>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.stats)
    if (stored) {
      try { return JSON.parse(stored) as StatsState } catch {}
    }
    return { totalAnswers: 0, correctAnswers: 0 }
  })

  useEffect(() => {
    if (allQuestions.length === 0) return
    setSession((prev) => {
      const updated: SessionState = { ...prev, questionStates: { ...prev.questionStates } }
      for (const q of allQuestions) {
        if (!updated.questionStates[q.id]) {
          updated.questionStates[q.id] = {
            questionId: q.id,
            consecutiveCorrect: 0,
            isExcluded: false,
          }
        }
      }
      return updated
    })
  }, [allQuestions.length])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats))
  }, [stats])

  const activeCount = useMemo(() =>
    Object.values(session.questionStates).filter((qs) => !qs.isExcluded).length,
  [session.questionStates])

  const totalCount = allQuestions.length
  const completedCount = Math.max(totalCount - activeCount, 0)
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const currentQuestion = useMemo(() =>
    allQuestions.find((q) => q.id === session.currentQuestionId) || null,
  [allQuestions, session.currentQuestionId])

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [showExcludedNotice, setShowExcludedNotice] = useState(false)

  const displayedOptions = useMemo(() => {
    if (!currentQuestion) return []
    const options = [...currentQuestion.options]
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = options[i]
      options[i] = options[j]
      options[j] = tmp
    }
    return options
  }, [currentQuestion?.id])

  useEffect(() => {
    setSelectedIdx(null)
    setHasAnswered(false)
    setShowExcludedNotice(false)
  }, [session.currentQuestionId])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!currentQuestion) return
      if (!hasAnswered) {
        if (e.key === '1') handleAnswer(0)
        if (e.key === '2') handleAnswer(1)
        if (e.key === '3') handleAnswer(2)
      } else {
        if (e.key === 'Enter') handleNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentQuestion?.id, hasAnswered, displayedOptions])

  function pickNextQuestionId(questions: Question[], states: Record<number, SessionQuestionState>): number | null {
    const candidates = questions.filter((q) => !states[q.id]?.isExcluded)
    if (candidates.length === 0) return null
    const next = candidates[Math.floor(Math.random() * candidates.length)]
    return next.id
  }

  function handleAnswer(idx: number) {
    if (hasAnswered || !currentQuestion) return
    setSelectedIdx(idx)
    setHasAnswered(true)

    const isCorrect = displayedOptions[idx]?.isCorrect === true

    // Update stats
    setStats((prev) => ({
      totalAnswers: prev.totalAnswers + 1,
      correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
    }))

    let excludedNow = false
    setSession((prev) => {
      const qs = prev.questionStates[currentQuestion.id]
      const nextQs: SessionQuestionState = {
        ...qs,
        consecutiveCorrect: isCorrect ? qs.consecutiveCorrect + 1 : 0,
        isExcluded: false,
      }
      if (isCorrect && nextQs.consecutiveCorrect >= 5) {
        nextQs.isExcluded = true
        excludedNow = true
      }
      return {
        ...prev,
        questionStates: { ...prev.questionStates, [currentQuestion.id]: nextQs },
      }
    })

    if (excludedNow) {
      setShowExcludedNotice(true)
      setTimeout(() => {
        handleNext()
      }, 800)
    }
  }

  function handleNext() {
    if (!currentQuestion) return
    setSession((prev) => {
      const nextId = pickNextQuestionId(allQuestions, prev.questionStates)
      return { ...prev, currentQuestionId: nextId }
    })
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEYS.session)
    localStorage.removeItem(STORAGE_KEYS.timerStart)
    localStorage.removeItem(STORAGE_KEYS.stats)
    setSession({ questionStates: {}, currentQuestionId: null })
    setStats({ totalAnswers: 0, correctAnswers: 0 })
    resetTimer()
  }

  const currentStreak = currentQuestion ? (session.questionStates[currentQuestion.id]?.consecutiveCorrect || 0) : 0
  const accuracy = stats.totalAnswers > 0 ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100) : 0

  // Circle timer (decorative 30s loop)
  const circleLen = 326
  const loopRatio = (elapsedMs % 30000) / 30000
  const dashOffset = circleLen * loopRatio

  if (error) {
    return <div style={{ padding: 24 }}>Ошибка загрузки: {error}</div>
  }

  if (!raw || allQuestions.length === 0) {
    return <div style={{ padding: 24 }}>Загрузка вопросов...</div>
  }

  const isFinished = activeCount === 0

  return (
    <div className="container">
      {/* Top bar with mini stats or altimeter+timer depending on state */}
      {!session.currentQuestionId || isFinished ? (
        <div className="topbar">
          <div className="glass-card mini-stats">
            <div>
              <span className="label">Время</span>
              <span className="value">{timeFormatted}</span>
            </div>
            <div>
              <span className="label">Точность</span>
              <span className="value">{accuracy}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="topbar row">
          <div className="glass-card altimeter">
            <div className="alt-label">Осталось</div>
            <div className="alt-value">{activeCount}/{totalCount}</div>
          </div>
          <div className="glass-card timer">
            <svg viewBox="0 0 120 120" className="timer-svg">
              <circle cx="60" cy="60" r="52" className="timer-bg" />
              <circle cx="60" cy="60" r="52" className="timer-fg" style={{ strokeDashoffset: dashOffset }} />
              <text x="60" y="66" textAnchor="middle" className="timer-text">{timeFormatted}</text>
            </svg>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="progress">
        <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        <div className="progress-text">{completedCount}/{totalCount}</div>
      </div>

      <main className="content">
        {!session.currentQuestionId || isFinished ? (
          <div className="center">
            {/* Home or Finish */}
            {!isFinished ? (
              <>
                <div className="center-logo">
                  <div className="logo-plane">
                    <svg width="140" height="140" viewBox="0 0 164 164">
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
                <div className="actions-col" style={{ position: 'static' }}>
                  <button className="btn primary breath" onClick={() => {
                    setSession((prev) => {
                      const nextId = pickNextQuestionId(allQuestions, prev.questionStates)
                      return { ...prev, currentQuestionId: nextId }
                    })
                  }}>Начать тест</button>
                  <button className="btn danger subtle" onClick={handleReset}>Сбросить прогресс</button>
                  <div className="stages">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`stage ${progressPercent >= (i+1)*20 ? 'active' : ''}`} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="landing">
                  <div className="runway" />
                  <div className="plane-anim" />
                </div>
                <div className="finish-title">Тест завершен!</div>
                <div className="stats-grid">
                  <div className="glass-card stat big-clock">
                    <div className="clock-face">
                      <div className="hand h1" />
                      <div className="hand h2" />
                      <div className="center" />
                    </div>
                    <div className="clock-text">{timeFormatted}</div>
                  </div>
                  <div className="glass-card stat path">
                    <div className="path-chart">
                      <svg viewBox="0 0 240 80">
                        <polyline points="0,60 40,50 80,55 120,35 160,30 200,20 240,25" className="path-line" />
                        <circle cx="0" cy="60" r="3" className="path-dot" />
                        <circle cx="120" cy="35" r="3" className="path-dot" />
                        <circle cx="240" cy="25" r="3" className="path-dot" />
                      </svg>
                    </div>
                    <div className="path-label">Траектория успеваемости</div>
                  </div>
                  <div className="glass-card stat report">
                    <div className="report-row"><span>Точность</span><span>{accuracy}%</span></div>
                    <div className="report-row"><span>Ответов</span><span>{stats.totalAnswers}</span></div>
                    <div className="report-row"><span>Исключено</span><span>{completedCount}</span></div>
                  </div>
                </div>
                <div className="finish-actions">
                  <button className="btn primary" onClick={() => setSession((prev) => ({ ...prev, currentQuestionId: pickNextQuestionId(allQuestions, prev.questionStates) }))}>Новый тест</button>
                  <button className="btn secondary" onClick={handleReset}>Сбросить прогресс</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            <div className="glass-card question-card glass">
              <div className="question-head">
                <div>
                  <div className="q-marker">
                    <span className="pin" />
                    <span className="q-num">{currentQuestion?.id}</span>
                  </div>
                  <div className="q-text">{currentQuestion?.text}</div>
                </div>
                <div className="streak" title="5 подряд для исключения">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < currentStreak ? 'dot filled' : 'dot'} />
                  ))}
                </div>
              </div>
              {showExcludedNotice && (
                <div className="notice excluded">Вопрос исключён из сессии</div>
              )}
            </div>

            <div className="answers-col">
              {displayedOptions.map((opt, idx) => {
                const isSelected = selectedIdx === idx
                const isCorrectSelected = hasAnswered && isSelected && opt.isCorrect
                const isIncorrectSelected = hasAnswered && isSelected && !opt.isCorrect
                const className = [
                  'answer-btn',
                  isCorrectSelected ? 'correct animate-ok' : '',
                  isIncorrectSelected ? 'incorrect' : '',
                ].join(' ')
                const label = idx === 0 ? 'A' : idx === 1 ? 'B' : 'C'
                return (
                  <button
                    key={idx}
                    className={className}
                    onClick={() => handleAnswer(idx)}
                    disabled={hasAnswered}
                  >
                    <span className="label">{label}</span>
                    <span>{opt.text}</span>
                    {isCorrectSelected && <span className="ico ok" />}
                  </button>
                )}
              )}
            </div>

            <div className="bottom">
              <button className="btn primary glow" onClick={handleNext} disabled={!hasAnswered}>Далее ↵</button>
              <div className="route">
                <div className="dot" />
                <div className="line" />
                <div className="dot" />
                <div className="line" />
                <div className="dot active" />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
