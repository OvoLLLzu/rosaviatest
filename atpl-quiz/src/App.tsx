import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

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

const STORAGE_KEYS = {
  session: 'atpl-quiz-session-v1',
  timerStart: 'atpl-quiz-timer-start-v1',
}

function parseQuestions(raw: string): Question[] {
  // Split by separators lines of underscores; keep only non-empty blocks
  const blocks = raw
    .split(/\n\s*_{35,}\s*\n/g) // lines of underscores surrounded by newlines
    .map((b) => b.trim())
    .filter((b) => b.length > 0)

  const questions: Question[] = []
  for (const block of blocks) {
    // Extract lines, ignore empty lines
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length < 4) continue

    // First line could be an empty line due to formatting; ensure question line contains number.
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

    // The next lines should include exactly 3 options (may include semicolons). Some lines may join; we assume each option is on its own line, optionally ending with ';'.
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

  // Deduplicate by id keeping first occurrence
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
    // Initialize or reuse start time
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

  // Session state persistence
  type SessionState = {
    questionStates: Record<number, SessionQuestionState>
    currentQuestionId: number | null
  }

  const { formatted: timeFormatted, reset: resetTimer } = usePersistentTimer()

  const [session, setSession] = useState<SessionState>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.session)
    if (stored) {
      try {
        return JSON.parse(stored) as SessionState
      } catch {}
    }
    return { questionStates: {}, currentQuestionId: null }
  })

  // Initialize session question states once questions load
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
      // Do not auto-start the test here; wait for "Начать тест"
      return updated
    })
  }, [allQuestions.length])

  // Persist session
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session))
  }, [session])

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

  // Shuffle options each time question changes
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
    // Reset selection when question changes
    setSelectedIdx(null)
    setHasAnswered(false)
    setShowExcludedNotice(false)
  }, [session.currentQuestionId])

  // Keyboard shortcuts: 1/2/3 to answer, Enter to Next
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
      // Auto-advance after a short delay when excluded
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
    setSession({ questionStates: {}, currentQuestionId: null })
    resetTimer()
  }

  // Streak for current question
  const currentStreak = currentQuestion ? (session.questionStates[currentQuestion.id]?.consecutiveCorrect || 0) : 0

  if (error) {
    return <div style={{ padding: 24 }}>Ошибка загрузки: {error}</div>
  }

  if (!raw || allQuestions.length === 0) {
    return <div style={{ padding: 24 }}>Загрузка вопросов...</div>
  }

  const isFinished = activeCount === 0

  return (
    <div className="container">
      <header className="header">
        <div className="left">Вопросов в сессии: {activeCount} / {totalCount}</div>
        <div className="right">Время: {timeFormatted}</div>
      </header>

      <div className="progress">
        <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        <div className="progress-text">{completedCount}/{totalCount}</div>
      </div>

      <main className="content">
        {!session.currentQuestionId || isFinished ? (
          <div className="center">
            <h1 className="title">Тест на ATPL</h1>
            {isFinished ? (
              <p>Тестирование завершено. Все вопросы исключены.</p>
            ) : (
              <p>Нажмите «Начать тест», чтобы начать.</p>
            )}
            <div className="actions">
              {!isFinished && (
                <button className="primary" onClick={() => {
                  setSession((prev) => {
                    const nextId = pickNextQuestionId(allQuestions, prev.questionStates)
                    return { ...prev, currentQuestionId: nextId }
                  })
                }}>Начать тест</button>
              )}
              <button className="secondary" onClick={handleReset}>Сбросить прогресс</button>
            </div>
          </div>
        ) : (
          <div className="question-card">
            <div className="question-head">
              <div className="question-text">
                {currentQuestion?.id}. {currentQuestion?.text}
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
            <div className="answers">
              {displayedOptions.map((opt, idx) => {
                const isSelected = selectedIdx === idx
                const isCorrectSelected = hasAnswered && isSelected && opt.isCorrect
                const isIncorrectSelected = hasAnswered && isSelected && !opt.isCorrect
                const className = [
                  'answer',
                  isSelected ? 'selected' : '',
                  isCorrectSelected ? 'correct' : '',
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
                    <span className="badge">{label}</span>
                    <span>{opt.text}</span>
                  </button>
                )
              })}
            </div>
            <div className="actions">
              <button className="primary" onClick={handleNext} disabled={!hasAnswered}>Далее ↵</button>
              <button className="secondary" onClick={handleReset}>Сбросить прогресс</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
