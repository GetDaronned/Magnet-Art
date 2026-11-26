import { useEffect, useState } from 'react'
import Layout from '../pages/Layout.jsx'
import Stage, { Legend } from './Stage.jsx'
import { DECOUVERTE, GRANDEURS, REFS } from './vendor/aimantarium.js'
import { applySet, createSim, makeHost, markQty, rememberQuestion, savedQuestion } from './sim.js'
import './discover.css'

// Quiz facultatif d'un chapitre : une question à deux choix par étape, la
// simulation préparée pour l'observer, un indice si on se trompe, puis
// l'explication (et, repliés, les limites du modèle et les sources).

function chapterQty(chapter) {
  const out = []
  chapter.steps.forEach((s) => (s.qty || []).forEach((k) => out.includes(k) || out.push(k)))
  return out
}

function Sources({ ids }) {
  return (
    <p className="d-sources">
      {ids.map((key, i) => {
        const ref = REFS[key]
        if (!ref) return null
        return (
          <span key={key}>
            {i > 0 && ' · '}
            <a href={ref[1]} target="_blank" rel="noopener noreferrer">
              {ref[0].split(/[,«]/)[0].trim()} ↗
            </a>
          </span>
        )
      })}
    </p>
  )
}

function QuizRun({ chapter }) {
  const total = chapter.steps.length
  const [toast, setToast] = useState('')
  const [sim] = useState(() => createSim(chapter.id, makeHost(setToast)))
  const [st, setSt] = useState(() => {
    const saved = savedQuestion(chapter.id)
    return { index: saved < total ? saved : 0, answer: null, revealed: false }
  })
  const step = chapter.steps[st.index]

  // Chaque question prépare la simulation à observer.
  useEffect(() => {
    if (!step) return
    applySet(sim, step.setup, step.reset)
    if (step.prepare) step.prepare(sim)
  }, [sim, step])
  // L'explication affichée (bonne réponse ou « voir l'explication ») débloque
  // les grandeurs de la question dans le carnet des notions.
  const explained = !!step && (st.answer === step.answer || st.revealed)
  useEffect(() => {
    if (explained) markQty(step.qty)
  }, [explained, step])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3400)
    return () => clearTimeout(t)
  }, [toast])

  const go = (index) => {
    rememberQuestion(chapter.id, index === total ? 0 : index)
    setSt({ index, answer: null, revealed: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  let panel
  if (!step) {
    panel = (
      <>
        <h3>À retenir</h3>
        <ul className="d-summary">
          {chapterQty(chapter).map((k) => (
            <li key={k}>
              <strong>{GRANDEURS[k].name}</strong>
              <br />
              {GRANDEURS[k].role}
            </li>
          ))}
        </ul>
        <div className="d-foot">
          <a className="btn primary" href={'#explore-' + chapter.id}>
            Retour à l’expérience
          </a>
          <button className="link" onClick={() => go(0)}>
            Rejouer le quiz
          </button>
        </div>
      </>
    )
  } else {
    const correct = st.answer === step.answer
    const show = correct || st.revealed
    panel = (
      <>
        <h3>{step.question}</h3>
        <div className="d-options">
          {step.choices.map((choice, i) => (
            <button
              key={i}
              className={'d-option' + (show && i === step.answer ? ' correct' : '') + (st.answer === i ? ' picked' : '')}
              aria-pressed={st.answer === i}
              disabled={show}
              onClick={() => setSt((s) => ({ ...s, answer: i }))}
            >
              {choice}
            </button>
          ))}
        </div>
        {!show && st.answer !== null && (
          <>
            <p className="d-fb" role="status">
              {step.hint}
            </p>
            <button className="link" onClick={() => setSt((s) => ({ ...s, revealed: true }))}>
              Voir l’explication
            </button>
          </>
        )}
        {show && (
          <>
            <div className="d-explain">
              <h3>{correct ? 'Bien vu !' : 'La bonne réponse'}</h3>
              {!correct && (
                <p>
                  <strong>{step.choices[step.answer]}</strong>
                </p>
              )}
              <p>{step.explain}</p>
              <details>
                <summary>Le modèle et ses limites</summary>
                <p>{step.limit}</p>
                <Sources ids={step.sources} />
              </details>
            </div>
            <div className="d-foot">
              <button className="btn primary" onClick={() => go(st.index + 1)}>
                {st.index + 1 === total ? 'Terminer le quiz' : 'Question suivante'} →
              </button>
            </div>
          </>
        )}
        <div className="d-foot small">
          <a className="link" href={'#explore-' + chapter.id}>
            Revenir à l’expérience
          </a>
          {st.index > 0 && (
            <button className="link" onClick={() => go(st.index - 1)}>
              Question précédente
            </button>
          )}
        </div>
      </>
    )
  }

  return (
    <Layout current="decouverte" wide>
      <a className="d-back" href={'#explore-' + chapter.id}>
        ← Exploration libre
      </a>
      <div className="d-meta">
        <span>Teste ta compréhension · {chapter.short}</span>
        <span>{step ? `Question ${st.index + 1} sur ${total}` : 'Quiz terminé'}</span>
      </div>
      <progress className="d-progress" max={total} value={step ? st.index + 1 : total} aria-label="Progression du quiz" />
      <h1 className="d-title">{step ? step.name : chapter.short}</h1>
      {step && step.intro && <p className="d-intro">{step.intro}</p>}
      <div className="d-lab">
        <div className="d-main">
          <div className="d-stage">
            <Stage sim={sim} interactive={false} label={step ? step.observe : chapter.short} />
            {toast && (
              <div className="d-toast" role="status">
                {toast}
              </div>
            )}
          </div>
          {step && step.legend && <Legend />}
          {step && step.observe && <p className="d-caption">{step.observe}</p>}
        </div>
        <section className="d-panel" aria-live="polite">
          {panel}
        </section>
      </div>
    </Layout>
  )
}

export default function Quiz({ id }) {
  const chapter = DECOUVERTE.find((c) => c.id === id)
  if (!chapter) {
    return (
      <Layout current="decouverte">
        <p>
          Chapitre introuvable. <a href="#decouverte">Retour à la Découverte</a>
        </p>
      </Layout>
    )
  }
  return <QuizRun key={id} chapter={chapter} />
}
