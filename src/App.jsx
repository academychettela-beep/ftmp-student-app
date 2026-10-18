import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, BarChart3, ArrowLeft, RotateCcw, LogOut } from 'lucide-react';
import AuthGate from './components/AuthGate.jsx';
import { Blocks, sc } from './BlockRenderer.jsx';
import {
  fetchModuleWithChapters,
  fetchProgress,
  fetchQuizAttempts,
  markChapterRead,
  submitQuizAttempt,
  signOut,
  getSession,
} from './lib/api.js';

const TOKENS = {
  navy: '#16213E',
  gold: '#C9A227',
  goldInk: '#7A5A16',
  parchment: '#F5F0E6',
  parchmentLine: '#E0D6BC',
  ink: '#2B2B28',
};

// Change this to load a different module once more are imported.
const MODULE_NUMBER = 1;

function AppShell() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [studentId, setStudentId] = useState(null);
  const [moduleData, setModuleData] = useState(null); // { module, chapters }
  const [progress, setProgress] = useState({});
  const [quizAttempts, setQuizAttempts] = useState({});

  const [view, setView] = useState('chapters');
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        const uid = session?.user?.id;
        setStudentId(uid);

        const [mod, prog, attempts] = await Promise.all([
          fetchModuleWithChapters(MODULE_NUMBER),
          fetchProgress(uid),
          fetchQuizAttempts(uid),
        ]);
        setModuleData(mod);
        setProgress(prog);
        setQuizAttempts(attempts);
        setActiveChapterId(mod.chapters[0]?.id ?? null);
      } catch (err) {
        console.error(err);
        setLoadError(
          'Could not load course content. Check that your .env has the right Supabase URL/key and that supabase/schema.sql has been run, with at least one module and chapter inserted.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: '#6B6A62' }}>Loading your course…</div>;
  }
  if (loadError) {
    return (
      <div className="p-6 text-sm max-w-lg" style={{ color: '#A65D57' }}>
        {loadError}
      </div>
    );
  }

  const chapters = moduleData.chapters;
  const activeChapter = chapters.find((c) => c.id === activeChapterId);
  const quiz = activeChapter?.quizzes?.[0]; // one quiz per chapter, as designed
  const completedCount = Object.values(progress).filter(Boolean).length;

  function bestScore(quizId) {
    const attempts = quizAttempts[quizId];
    if (!attempts || attempts.length === 0) return null;
    return Math.max(...attempts);
  }

  function openChapter(id) {
    setActiveChapterId(id);
    setView('reader');
  }

  async function handleMarkRead(chapterId) {
    setProgress((p) => ({ ...p, [chapterId]: true })); // optimistic
    try {
      await markChapterRead(studentId, chapterId);
    } catch (err) {
      console.error(err);
    }
  }

  function startQuiz() {
    setAnswers({});
    setSubmitted(false);
    setView('quiz');
  }

  function selectAnswer(qId, optIndex) {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [qId]: optIndex }));
  }

  async function handleSubmitQuiz() {
    const total = quiz.questions.length;
    const correct = quiz.questions.filter((q) => answers[q.id] === q.correct_index).length;
    const score = Math.round((correct / total) * 100);
    setSubmitted(true);
    setQuizAttempts((prev) => {
      const existing = prev[quiz.id] || [];
      return { ...prev, [quiz.id]: [...existing, score] };
    });
    try {
      await submitQuizAttempt(studentId, quiz.id, score);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{ fontFamily: 'Lato, sans-serif', background: TOKENS.parchment, color: TOKENS.ink, minHeight: '600px' }} className="w-full">
      <div style={{ background: TOKENS.navy }} className="px-6 py-4 flex items-center justify-between">
        <div>
          <div style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.gold }} className="text-xl font-semibold leading-none">
            Chettela Forex Academy
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', color: '#B9C0D4' }} className="text-xs mt-1">
            Forex Trading Mastery Program — Module {moduleData.module.number}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('chapters')}
            style={{ fontFamily: 'Montserrat, sans-serif', color: view !== 'progress' ? TOKENS.navy : '#D8DCE8', background: view !== 'progress' ? TOKENS.gold : 'transparent' }}
            className="text-sm px-3 py-1.5 rounded"
          >
            Chapters
          </button>
          <button
            onClick={() => setView('progress')}
            style={{ fontFamily: 'Montserrat, sans-serif', color: view === 'progress' ? TOKENS.navy : '#D8DCE8', background: view === 'progress' ? TOKENS.gold : 'transparent' }}
            className="text-sm px-3 py-1.5 rounded"
          >
            My Progress
          </button>
          <button onClick={signOut} title="Sign out" className="text-sm p-1.5 rounded" style={{ color: '#D8DCE8' }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {view === 'chapters' && (
          <div>
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-2xl font-semibold mb-1">
              {moduleData.module.title}
            </h1>
            <p style={{ color: '#6B6A62' }} className="text-sm mb-5">
              {completedCount} of {chapters.length} chapters complete
            </p>
            <div className="flex flex-col gap-2">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => openChapter(ch.id)}
                  style={{ background: 'white', borderColor: TOKENS.parchmentLine }}
                  className="flex items-center gap-3 border rounded px-4 py-3 text-left hover:shadow-sm transition"
                >
                  {progress[ch.id] ? (
                    <CheckCircle2 size={20} style={{ color: TOKENS.goldInk }} />
                  ) : (
                    <Circle size={20} style={{ color: TOKENS.parchmentLine }} />
                  )}
                  <span style={{ color: TOKENS.goldInk, fontFamily: 'Montserrat, sans-serif' }} className="text-xs w-6">
                    {String(ch.number).padStart(2, '0')}
                  </span>
                  <span style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-lg font-medium flex-1">
                    {sc(ch.title)}
                  </span>
                  {ch.quizzes?.[0] && bestScore(ch.quizzes[0].id) !== null && (
                    <span style={{ color: '#6B6A62' }} className="text-xs">
                      Best: {bestScore(ch.quizzes[0].id)}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'reader' && activeChapter && (
          <div className="max-w-2xl">
            <button onClick={() => setView('chapters')} className="flex items-center gap-1 text-sm mb-4" style={{ color: TOKENS.goldInk }}>
              <ArrowLeft size={16} /> Back to chapters
            </button>
            <div style={{ fontFamily: 'Montserrat, sans-serif', color: TOKENS.goldInk }} className="text-xs mb-1">
              Chapter {activeChapter.number}
            </div>
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-3xl font-semibold mb-4">
              {sc(activeChapter.title)}
            </h1>
            {Array.isArray(activeChapter.blocks) && activeChapter.blocks.length > 0 ? (
              <Blocks blocks={activeChapter.blocks} title={activeChapter.title} />
            ) : (
              <div style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{activeChapter.content}</div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleMarkRead(activeChapter.id)}
                style={{
                  background: progress[activeChapter.id] ? TOKENS.parchmentLine : TOKENS.navy,
                  color: progress[activeChapter.id] ? TOKENS.ink : 'white',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                className="text-sm px-4 py-2 rounded"
              >
                {progress[activeChapter.id] ? 'Marked as read' : 'Mark as read'}
              </button>
              {quiz && (
                <button
                  onClick={startQuiz}
                  style={{ background: TOKENS.gold, color: TOKENS.navy, fontFamily: 'Montserrat, sans-serif' }}
                  className="text-sm px-4 py-2 rounded font-semibold"
                >
                  Take the quiz
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'quiz' && activeChapter && quiz && (
          <div className="max-w-2xl">
            <button onClick={() => setView('reader')} className="flex items-center gap-1 text-sm mb-4" style={{ color: TOKENS.goldInk }}>
              <ArrowLeft size={16} /> Back to chapter
            </button>
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-2xl font-semibold mb-5">
              {quiz.title}
            </h1>
            <div className="flex flex-col gap-5">
              {quiz.questions.map((q, qi) => (
                <div key={q.id}>
                  <p className="font-medium mb-2">
                    {qi + 1}. {q.prompt}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt, oi) => {
                      const isSelected = answers[q.id] === oi;
                      const isCorrect = oi === q.correct_index;
                      let border = TOKENS.parchmentLine;
                      let bg = 'white';
                      if (submitted) {
                        if (isCorrect) {
                          border = '#5C7A5C';
                          bg = '#EEF3EA';
                        } else if (isSelected && !isCorrect) {
                          border = '#A65D57';
                          bg = '#F7EBEA';
                        }
                      } else if (isSelected) {
                        border = TOKENS.gold;
                        bg = '#FBF6E8';
                      }
                      return (
                        <button
                          key={oi}
                          onClick={() => selectAnswer(q.id, oi)}
                          style={{ borderColor: border, background: bg, textAlign: 'left' }}
                          className="border rounded px-3 py-2 text-sm"
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {!submitted ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={Object.keys(answers).length < quiz.questions.length}
                style={{
                  background: TOKENS.navy,
                  color: 'white',
                  fontFamily: 'Montserrat, sans-serif',
                  opacity: Object.keys(answers).length < quiz.questions.length ? 0.4 : 1,
                }}
                className="text-sm px-4 py-2 rounded mt-6"
              >
                Submit answers
              </button>
            ) : (
              <div className="mt-6 flex items-center gap-4">
                <div style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-2xl font-semibold">
                  {Math.round((quiz.questions.filter((q) => answers[q.id] === q.correct_index).length / quiz.questions.length) * 100)}%
                </div>
                <button
                  onClick={startQuiz}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 rounded border"
                  style={{ borderColor: TOKENS.parchmentLine, color: TOKENS.goldInk }}
                >
                  <RotateCcw size={14} /> Retake
                </button>
                <span style={{ color: '#6B6A62' }} className="text-xs">
                  Best score is kept automatically
                </span>
              </div>
            )}
          </div>
        )}

        {view === 'progress' && (
          <div className="max-w-2xl">
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-2xl font-semibold mb-5 flex items-center gap-2">
              <BarChart3 size={22} style={{ color: TOKENS.gold }} /> My Progress
            </h1>
            <div className="flex flex-col gap-2">
              {chapters.map((ch) => (
                <div key={ch.id} style={{ background: 'white', borderColor: TOKENS.parchmentLine }} className="flex items-center gap-3 border rounded px-4 py-3">
                  {progress[ch.id] ? <CheckCircle2 size={18} style={{ color: TOKENS.goldInk }} /> : <Circle size={18} style={{ color: TOKENS.parchmentLine }} />}
                  <span style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="flex-1">
                    {sc(ch.title)}
                  </span>
                  <span style={{ color: '#6B6A62' }} className="text-xs">
                    {ch.quizzes?.[0] && bestScore(ch.quizzes[0].id) !== null ? `Quiz best: ${bestScore(ch.quizzes[0].id)}%` : 'Quiz not attempted'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}
