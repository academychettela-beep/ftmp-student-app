import React, { useEffect, useMemo, useState } from 'react';
import { fetchMentorWrittenAnswers, reviewWrittenAnswer } from '../lib/api.js';

export default function MentorReview({ onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  async function reload() {
    setError('');
    try { setRows(await fetchMentorWrittenAnswers()); }
    catch (e) { setError(e.message || String(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);
  const shown = useMemo(() => rows.filter(r => filter === 'all' || (r.review_status || 'pending') === filter), [rows, filter]);
  async function assess(row, status) {
    if (busy) return;
    setBusy(row.id); setError(''); setNotice('');
    try {
      const saved = await reviewWrittenAnswer(row.id, status, drafts[row.id] ?? row.mentor_feedback ?? '');
      await reload();
      setNotice(`Review saved as ${saved.review_status}. The student should sign in with their own account and reload the quiz.`);
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusy(null); }
  }
  return <section className="max-w-3xl" aria-label="Mentor review dashboard">
    <button className="text-sm mb-4 underline" onClick={onBack}>Back to modules</button>
    <h1 className="text-3xl font-semibold mb-2">Mentor review</h1>
    <p className="text-sm mb-4">Written responses are reviewed manually; MCQ scores are unchanged.</p>
    <label className="text-sm">Show: <select className="border rounded p-2 ml-2" value={filter} onChange={e=>setFilter(e.target.value)}>
      <option value="pending">Pending</option><option value="reviewed">Reviewed</option>
      <option value="needs_improvement">Needs improvement</option><option value="all">All answers</option>
    </select></label>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-green-800">{notice}</p>}
    {loading ? <p className="mt-4">Loading answers…</p> : shown.length === 0 ? <p className="mt-4">No responses in this category.</p> :
    <div className="mt-4 flex flex-col gap-4">{shown.map(r => {
      const q = r.questions, quiz = q?.quizzes, ch = quiz?.chapters, mod = ch?.modules;
      return <article key={r.id} className="border rounded p-4 bg-white">
        <p className="text-xs mb-1">Student ID: {r.student_user_id}</p>
        <p className="text-xs mb-2">{mod ? `Module ${mod.number} · ` : ''}{ch ? `Chapter ${ch.number} · ` : ''}{quiz?.title || ''} · {r.review_status || 'pending'}</p>
        <h2 className="font-semibold mb-2">{q?.prompt || `Question ${r.question_id}`}</h2>
        <p className="whitespace-pre-wrap bg-gray-50 p-3 rounded mb-3">{r.answer_text}</p>
        <label className="block text-sm mb-1" htmlFor={`feedback-${r.id}`}>Feedback to student (optional)</label>
        <textarea id={`feedback-${r.id}`} className="w-full border rounded p-2 mb-3" rows={3}
          value={drafts[r.id] ?? r.mentor_feedback ?? ''}
          onChange={e=>setDrafts(d=>({...d, [r.id]:e.target.value}))} />
        <div className="flex gap-2 flex-wrap">
          <button disabled={!!busy} className="rounded px-3 py-2 bg-green-800 text-white disabled:opacity-50" onClick={()=>assess(r,'reviewed')}>Mark reviewed</button>
          <button disabled={!!busy} className="rounded px-3 py-2 bg-amber-600 text-white disabled:opacity-50" onClick={()=>assess(r,'needs_improvement')}>Needs improvement</button>
        </div>
      </article>;
    })}</div>}
  </section>;
}
