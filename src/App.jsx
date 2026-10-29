import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, BarChart3, ArrowLeft, RotateCcw, LogOut } from 'lucide-react';
import AuthGate from './components/AuthGate.jsx';
import MentorReview from './components/MentorReview.jsx';
import Certification from './components/Certification.jsx';
import CertificationMentor from './components/CertificationMentor.jsx';
import { Blocks, sc } from './BlockRenderer.jsx';
import { supabase } from './supabaseClient.js';
import {
  fetchModuleWithChapters,
  fetchProgress,
  fetchQuizAttempts,
  markChapterRead,
  submitQuizAttempt,
  fetchWrittenAnswers,
  submitWrittenAnswer,
  signOut,
  getSession,
  hasMentorRole,
} from './lib/api.js';

const TOKENS = {
  navy: '#16213E',
  gold: '#C9A227',
  goldInk: '#7A5A16',
  parchment: '#F5F0E6',
  parchmentLine: '#E0D6BC',
  ink: '#2B2B28',
};

// Light list of every module with its chapters (no chapter text), used by the module picker and My Progress.
async function fetchModulesLight() {
  const { data, error } = await supabase
    .from('modules')
    .select('id, number, title, chapters(id, number, title, quizzes(id))')
    .order('number');
  if (error) throw error;
  return data.map((m) => ({ ...m, chapters: [...m.chapters].sort((a, b) => a.number - b.number) }));
}

function moduleStats(m, progress, quizAttempts) {
  const total = m.chapters.length;
  const read = m.chapters.filter((c) => progress[c.id]).length;
  const bests = m.chapters
    .flatMap((c) => (c.quizzes || []).map((q) => quizAttempts[q.id]))
    .filter((a) => a && a.length)
    .map((a) => Math.max(...a));
  const avg = bests.length ? Math.round(bests.reduce((x, y) => x + y, 0) / bests.length) : null;
  return { total, read, avg };
}

function ProgressBar({ value, total }) {
  return (
    <div style={{ height: 6, background: TOKENS.parchmentLine, borderRadius: 3 }}>
      <div style={{ width: `${total ? Math.round((value / total) * 100) : 0}%`, height: 6, background: TOKENS.gold, borderRadius: 3 }} />
    </div>
  );
}

function AppShell() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [studentId, setStudentId] = useState(null);
  const [studentCode, setStudentCode] = useState(null);
  const [moduleData, setModuleData] = useState(null); // { module, chapters }
  const [progress, setProgress] = useState({});
  const [quizAttempts, setQuizAttempts] = useState({});

  const [view, setView] = useState('modules');
  const [modules, setModules] = useState([]);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [writtenAnswers, setWrittenAnswers] = useState({}); // { [question_id]: saved text }
  const [draftText, setDraftText] = useState({});           // { [question_id]: text being typed, not yet saved }
  const [savingId, setSavingId] = useState(null);
  const [writtenError, setWrittenError] = useState('');
  const [isMentor, setIsMentor] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        const uid = session?.user?.id;
        setStudentId(uid);
        try { setIsMentor(await hasMentorRole()); } catch (e) { console.warn("Mentor role lookup failed:", e); }

        // Student ID (e.g. CFA-0001) is assigned by the database; show it if this student has one.
        supabase
          .from('students')
          .select('student_code')
          .eq('id', uid)
          .maybeSingle()
          .then(({ data }) => setStudentCode((data && data.student_code) || null));

        const [mods, prog, attempts] = await Promise.all([
          fetchModulesLight(),
          fetchProgress(uid),
          fetchQuizAttempts(uid),
        ]);
        setModules(mods);
        setProgress(prog);
        setQuizAttempts(attempts);
        try { setWrittenAnswers(await fetchWrittenAnswers(uid)); }
        catch (e) { console.warn('Written answers could not load:', e); }
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

  const chapters = moduleData ? moduleData.chapters : [];
  const activeChapter = chapters.find((c) => c.id === activeChapterId);
  const quiz = activeChapter?.quizzes?.[0]; // one quiz per chapter, as designed
  const completedCount = chapters.filter((c) => progress[c.id]).length;
  const allStats = modules.map((m) => moduleStats(m, progress, quizAttempts));
  const allRead = allStats.reduce((a, st) => a + st.read, 0);
  const allTotal = allStats.reduce((a, st) => a + st.total, 0);

  function bestScore(quizId) {
    const attempts = quizAttempts[quizId];
    if (!attempts || attempts.length === 0) return null;
    return Math.max(...attempts);
  }

  async function openModule(number) {
    setOpening(true);
    setOpenError('');
    try {
      const mod = await fetchModuleWithChapters(number);
      setModuleData(mod);
      setActiveChapterId(mod.chapters[0]?.id ?? null);
      setView('chapters');
    } catch (err) {
      console.error(err);
      setOpenError('Could not open this module. Please check your connection and try again.');
    } finally {
      setOpening(false);
    }
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

  async function startQuiz() {
    setAnswers({});
    setSubmitted(false);
    setDraftText({});
    setWrittenError('');
    setView('quiz');
    // Re-read the server when the student opens the quiz, including
    // review_status and mentor_feedback updated since the last sign-in.
    if (studentId) {
      try {
        const latest = await fetchWrittenAnswers(studentId);
        setWrittenAnswers(latest);
      } catch (err) {
        console.error('Unable to refresh review statuses:', err);
        setWrittenError(`Could not refresh mentor review status: ${err.message || String(err)}`);
      }
    }
  }

  function selectAnswer(qId, optIndex) {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [qId]: optIndex }));
  }

  function wordCount(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  async function handleSaveWritten(questionId) {
    const text = (draftText[questionId] || '').trim();
    const words = wordCount(text);
    if (words < 1 || words > 100) {
      setWrittenError('Write between 1 and 100 words before saving.');
      return;
    }
    setWrittenError('');
    setSavingId(questionId);
    try {
      await submitWrittenAnswer(studentId, questionId, text);
      setWrittenAnswers((w) => ({ ...w, [questionId]: { question_id: questionId, answer_text: text, review_status: 'pending', mentor_feedback: null } }));
    } catch (err) {
      console.error(err);
      setWrittenError('Could not save your answer. Check your connection and try again.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleSubmitQuiz() {
    const mcqQuestions = quiz.questions.filter((q) => q.type !== 'short_answer');
    const total = mcqQuestions.length;
    const correct = mcqQuestions.filter((q) => answers[q.id] === q.correct_index).length;
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
        <div className="flex items-center gap-3 min-w-0">
          <img src={`${import.meta.env.BASE_URL}cfa-logo.png`} alt="The Chettela Forex Academy logo" className="w-16 sm:w-20 h-auto shrink-0 object-contain" />
          <div>
          <div style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.gold }} className="text-xl font-semibold leading-none">
            Chettela Forex Academy
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', color: '#B9C0D4' }} className="text-xs mt-1">
            Forex Trading Mastery Program{moduleData && ['chapters', 'reader', 'quiz'].includes(view) ? ` — Module ${moduleData.module.number}` : ''}
          </div>
          {studentCode && (
            <div style={{ fontFamily: 'Montserrat, sans-serif', color: TOKENS.gold }} className="text-xs mt-1">
              Student ID: {studentCode}
            </div>
          )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('modules')}
            style={{ fontFamily: 'Montserrat, sans-serif', color: view !== 'progress' ? TOKENS.navy : '#D8DCE8', background: view !== 'progress' ? TOKENS.gold : 'transparent' }}
            className="text-sm px-3 py-1.5 rounded"
          >
            Modules
          </button>
          <button
            onClick={() => setView('progress')}
            style={{ fontFamily: 'Montserrat, sans-serif', color: view === 'progress' ? TOKENS.navy : '#D8DCE8', background: view === 'progress' ? TOKENS.gold : 'transparent' }}
            className="text-sm px-3 py-1.5 rounded"
          >
            My Progress
          </button>
          <button onClick={() => setView('certification')} className="text-sm px-3 py-1.5 rounded border" style={{color:TOKENS.gold,borderColor:TOKENS.gold}}>Certification</button>
          {isMentor && <button onClick={() => setView('certification-mentor')} className="text-sm px-3 py-1.5 rounded border" style={{color:TOKENS.gold,borderColor:TOKENS.gold}}>Certification grading</button>}
          {isMentor && <button onClick={() => setView('mentor')} className="text-sm px-3 py-1.5 rounded" style={{ color: TOKENS.navy, background: TOKENS.gold }}>Mentor review</button>}
          <button onClick={signOut} title="Sign out" className="text-sm p-1.5 rounded" style={{ color: '#D8DCE8' }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {view === 'mentor' && isMentor && <MentorReview onBack={() => setView('modules')} />}
        {view === 'certification-mentor' && isMentor && <CertificationMentor onBack={() => setView('modules')} />}
        {view === 'certification' && <Certification studentId={studentId} onBack={() => setView('modules')} />}
        {view === 'modules' && (
          <div className="max-w-3xl">
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy, fontSize: 40 }} className="font-semibold mb-1">
              Your modules
            </h1>
            <p style={{ color: '#6B6A62' }} className="text-sm mb-3">
              {allRead} of {allTotal} chapters read across the modules available so far
            </p>
            <ProgressBar value={allRead} total={allTotal} />
            {openError && <p className="text-sm mt-3" style={{ color: '#A65D57' }}>{openError}</p>}
            {modules.length === 0 && (
              <p className="text-sm mt-4" style={{ color: '#6B6A62' }}>No modules have been added yet.</p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginTop: 20 }}>
              {modules.map((m, i) => {
                const st = allStats[i];
                const status = st.read === 0 ? 'Not started' : st.read === st.total ? 'Completed' : 'In progress';
                const cta = st.read === 0 ? 'Start module' : st.read === st.total ? 'Review module' : 'Continue';
                return (
                  <div key={m.id} style={{ background: 'white', border: `1px solid ${TOKENS.parchmentLine}`, borderTop: `3px solid ${TOKENS.gold}`, borderRadius: 4, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontFamily: 'Montserrat, sans-serif', color: TOKENS.goldInk, fontWeight: 600 }} className="text-xs">Module {m.number}</span>
                      <span style={{ fontFamily: 'Montserrat, sans-serif', color: st.read ? TOKENS.navy : '#6B6A62', background: st.read ? '#FBF6E8' : '#F1EEE6', border: `1px solid ${TOKENS.parchmentLine}`, padding: '2px 8px', borderRadius: 999, fontSize: 11 }}>{status}</span>
                    </div>
                    <div style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy, fontSize: 27, fontWeight: 700, lineHeight: 1.15 }}>{sc(m.title)}</div>
                    <ProgressBar value={st.read} total={st.total} />
                    <div className="text-sm" style={{ color: '#6B6A62' }}>
                      {st.read} of {st.total} chapters read{st.avg !== null ? ` · quiz average ${st.avg}%` : ''}
                    </div>
                    <button
                      onClick={() => openModule(m.number)}
                      disabled={opening}
                      style={{ alignSelf: 'flex-start', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, background: st.read ? TOKENS.gold : TOKENS.navy, color: st.read ? TOKENS.navy : 'white', borderRadius: 4, padding: '8px 16px', opacity: opening ? 0.6 : 1 }}
                      className="text-sm"
                    >
                      {opening ? 'Opening…' : cta}
                    </button>
                  </div>
                );
              })}
              <div style={{ border: `1px dashed ${TOKENS.gold}`, borderRadius: 4, padding: '16px 18px', color: TOKENS.goldInk, fontFamily: '"Cormorant Garamond", serif', fontSize: 20 }} className="flex items-center">
                More modules will appear here as they are added.
              </div>
            </div>
          </div>
        )}

        {view === 'chapters' && moduleData && (
          <div>
            <button onClick={() => setView('modules')} className="flex items-center gap-1 text-sm mb-4" style={{ color: TOKENS.goldInk }}>
              <ArrowLeft size={16} /> All modules
            </button>
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-2xl font-semibold mb-1">
              {sc(moduleData.module.title)}
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
              {quiz.questions.map((q, qi) => {
                if (q.type === 'short_answer') {
                  const saved = writtenAnswers[q.id];
                  const draft = draftText[q.id] || '';
                  const words = wordCount(draft);
                  return (
                    <div key={q.id}>
                      <p className="font-medium mb-2">
                        {qi + 1}. {q.prompt}
                      </p>
                      {saved !== undefined ? (
                        <div style={{ background: '#FBF6E8', borderColor: TOKENS.parchmentLine }} className="border rounded px-3 py-2 text-sm">
                          <div style={{ whiteSpace: 'pre-wrap' }}>{saved.answer_text}</div>
                          <div style={{ fontFamily: 'Montserrat, sans-serif', color: TOKENS.goldInk }} className="text-xs mt-2">
                            {saved.review_status === 'reviewed' ? 'Reviewed by mentor' : saved.review_status === 'needs_improvement' ? 'Needs improvement — see mentor feedback' : 'Saved — pending mentor review'}
                          </div>
                          {saved.mentor_feedback && <p className="text-sm mt-2" style={{ whiteSpace: 'pre-wrap' }}>Mentor feedback: {saved.mentor_feedback}</p>}
                        </div>
                      ) : (
                        <div>
                          <textarea
                            value={draft}
                            onChange={(e) => setDraftText((d) => ({ ...d, [q.id]: e.target.value }))}
                            rows={4}
                            placeholder="Write your answer (up to 100 words)…"
                            style={{ borderColor: TOKENS.parchmentLine }}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                          <div className="flex items-center justify-between mt-1.5">
                            <span style={{ color: words > 100 ? '#A65D57' : '#6B6A62' }} className="text-xs">
                              {words}/100 words
                            </span>
                            <button
                              onClick={() => handleSaveWritten(q.id)}
                              disabled={savingId === q.id}
                              style={{ background: TOKENS.gold, color: TOKENS.navy, fontFamily: 'Montserrat, sans-serif', opacity: savingId === q.id ? 0.6 : 1 }}
                              className="text-sm px-3 py-1.5 rounded font-semibold"
                            >
                              {savingId === q.id ? 'Saving…' : 'Save answer'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
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
                );
              })}
            </div>

            {writtenError && <p className="text-sm mt-3" style={{ color: '#A65D57' }}>{writtenError}</p>}

            {quiz.questions.some((q) => q.type !== 'short_answer') && (
              !submitted ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={quiz.questions.filter((q) => q.type !== 'short_answer').some((q) => answers[q.id] === undefined)}
                  style={{
                    background: TOKENS.navy,
                    color: 'white',
                    fontFamily: 'Montserrat, sans-serif',
                    opacity: quiz.questions.filter((q) => q.type !== 'short_answer').some((q) => answers[q.id] === undefined) ? 0.4 : 1,
                  }}
                  className="text-sm px-4 py-2 rounded mt-6"
                >
                  Submit answers
                </button>
              ) : (
                <div className="mt-6 flex items-center gap-4">
                  <div style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-2xl font-semibold">
                    {(() => {
                      const mcq = quiz.questions.filter((q) => q.type !== 'short_answer');
                      return Math.round((mcq.filter((q) => answers[q.id] === q.correct_index).length / mcq.length) * 100);
                    })()}%
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
              )
            )}
          </div>
        )}

        {view === 'progress' && (
          <div className="max-w-2xl">
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-2xl font-semibold mb-5 flex items-center gap-2">
              <BarChart3 size={22} style={{ color: TOKENS.gold }} /> My Progress
            </h1>
            {modules.map((m, i) => (
              <div key={m.id} className="mb-6">
                <div style={{ fontFamily: '"Cormorant Garamond", serif', color: TOKENS.navy }} className="text-xl font-semibold">
                  Module {m.number}: {sc(m.title)}
                </div>
                <p className="text-xs mb-2" style={{ color: '#6B6A62' }}>
                  {allStats[i].read} of {allStats[i].total} chapters read{allStats[i].avg !== null ? ` · quiz average ${allStats[i].avg}%` : ''}
                </p>
                <div className="flex flex-col gap-2">
                  {m.chapters.map((ch) => (
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
            ))}
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
