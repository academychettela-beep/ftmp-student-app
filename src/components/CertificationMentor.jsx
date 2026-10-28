import React, { useEffect, useMemo, useState } from 'react';
import { fetchCertificationMentorAttempts, fetchCertificationMentorResponses, gradeCertificationWritten, reviewCertificationPractical, issueCertification } from '../lib/api.js';

export default function CertificationMentor({onBack}) {
  const [attempts,setAttempts]=useState([]),[selected,setSelected]=useState(''),[responses,setResponses]=useState([]);
  const [drafts,setDrafts]=useState({}),[practical,setPractical]=useState('pending'),[practicalFeedback,setPracticalFeedback]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const current=attempts.find(a=>a.id===selected);
  async function reloadAttempts(){const a=await fetchCertificationMentorAttempts();setAttempts(a);return a;}
  async function loadResponses(id){const r=await fetchCertificationMentorResponses(id);setResponses(r);setDrafts(Object.fromEntries(r.filter(x=>x.certification_questions?.type==='short_answer').map(x=>[x.question_id,{marks:x.awarded_marks===null?'':String(x.awarded_marks),feedback:x.mentor_feedback||''}])));}
  useEffect(()=>{(async()=>{try{await reloadAttempts();}catch(e){setError(e.message)}})()},[]);
  useEffect(()=>{if(!selected){setResponses([]);return;}setError('');loadResponses(selected).catch(e=>setError(e.message));const a=attempts.find(x=>x.id===selected);setPractical(a?.practical_status||'pending');setPracticalFeedback(a?.practical_feedback||'');},[selected]);
  const gradedCount=responses.filter(r=>r.awarded_marks!==null).length;
  const total=responses.reduce((n,r)=>n+(r.awarded_marks||0),0);
  const mcq=responses.filter(r=>r.certification_questions?.type==='mcq').reduce((n,r)=>n+(r.awarded_marks||0),0);
  const short=responses.filter(r=>r.certification_questions?.type==='short_answer').reduce((n,r)=>n+(r.awarded_marks||0),0);
  async function run(fn,done){setBusy(true);setError('');setNotice('');try{await fn();const a=await reloadAttempts();if(selected)await loadResponses(selected);setNotice(done);}catch(e){setError(e.message||String(e))}finally{setBusy(false)}}
  const canGrade=current&&['submitted','graded'].includes(current.status);
  return <section className="max-w-4xl mx-auto text-slate-900">
    <button onClick={onBack} className="mb-4 underline text-sm">← Back to modules</button>
    <h1 className="text-3xl font-semibold">Certification — Mentor Review</h1>
    <p className="my-3 text-sm">Theory: 20 MCQs scored automatically, 30 written answers graded here. Practical result is separate. Certificates require an explicit mentor decision.</p>
    {error&&<p role="alert" className="bg-red-50 text-red-800 p-3 mb-3 rounded">{error}</p>}
    {notice&&<p role="status" className="bg-green-50 text-green-800 p-3 mb-3 rounded">{notice}</p>}
    <label className="block font-medium mb-1" htmlFor="cert-student">Select a certification attempt</label>
    <div className="flex gap-2 mb-4"><select id="cert-student" className="border p-2 rounded flex-1" value={selected} onChange={e=>setSelected(e.target.value)}>
      <option value="">Choose student attempt</option>
      {attempts.map(a=><option key={a.id} value={a.id}>{a.student_user_id} · {a.status} · {new Date(a.created_at).toLocaleDateString()}</option>)}
    </select><button disabled={busy} onClick={()=>run(reloadAttempts,'Attempts refreshed')} className="border rounded px-3">Refresh</button></div>
    {selected&&!current&&<p>Attempt no longer available. Refresh the list.</p>}
    {current&&<>
      <div className="bg-white border rounded p-4 mb-5">
        <p><b>Student:</b> {current.student_user_id}</p>
        <p><b>Attempt:</b> {current.status} · <b>Written and MCQ responses graded:</b> {gradedCount}/50</p>
        <p><b>MCQ:</b> {mcq}/40 · <b>Written:</b> {short}/60 · <b>Theory total:</b> {total}/100</p>
        <p><b>Practical:</b> {current.practical_status} · <b>Certificate:</b> {current.certificate_status}</p>
        {current.status==='in_progress'&&<p className="text-amber-800 mt-2">The student has not submitted the examination. Grading is disabled.</p>}
      </div>
      <h2 className="text-xl font-semibold mb-3">Written-answer grading</h2>
      {responses.filter(r=>r.certification_questions?.type==='short_answer').map(r=>{const q=r.certification_questions;const d=drafts[r.question_id]||{marks:'',feedback:''};return <article key={r.question_id} className="bg-white border rounded p-4 mb-3">
        <h3 className="font-semibold mb-2">Q{q.question_number}. {q.prompt} ({q.max_marks} marks)</h3>
        <p className="bg-slate-50 p-3 whitespace-pre-wrap rounded mb-3">{r.written_answer||'(No response)'}</p>
        <div className="flex flex-wrap gap-3 mb-2 items-center"><label>Marks (0–{q.max_marks}) <input aria-label={`Marks for question ${q.question_number}`} type="number" min="0" max={q.max_marks} step="1" disabled={!canGrade||busy} className="border rounded p-2 w-20 ml-2" value={d.marks} onChange={e=>setDrafts(x=>({...x,[r.question_id]:{...d,marks:e.target.value}}))}/></label>
        <span className="text-xs">{r.awarded_marks===null?'Not graded':`Saved: ${r.awarded_marks}/${q.max_marks}`}</span></div>
        <label className="block mb-2">Mentor feedback <textarea rows={2} disabled={!canGrade||busy} className="w-full border rounded p-2" value={d.feedback} onChange={e=>setDrafts(x=>({...x,[r.question_id]:{...d,feedback:e.target.value}}))}/></label>
        <button disabled={!canGrade||busy||d.marks===''||!Number.isInteger(Number(d.marks))||Number(d.marks)<0||Number(d.marks)>q.max_marks} onClick={()=>run(()=>gradeCertificationWritten(selected,r.question_id,Number(d.marks),d.feedback),`Question ${q.question_number} graded`)} className="bg-slate-800 text-white rounded px-4 py-2 disabled:opacity-40">Save grade</button>
      </article>})}
      <div className="border rounded bg-white p-4 my-5"><h2 className="text-xl font-semibold">Demo-account practical assessment</h2>
        <p className="text-sm my-2">Check the student's trade plan, risk compliance, executed trades, journal and review evidence outside this form before recording a decision.</p>
        <label className="block mb-2">Practical result <select className="border rounded p-2 ml-2" value={practical} onChange={e=>setPractical(e.target.value)}><option value="pending">Pending</option><option value="passed">Passed</option><option value="not_passed">Not passed</option></select></label>
        <label className="block">Practical mentor feedback <textarea className="w-full border rounded p-2 mt-1" rows={3} value={practicalFeedback} onChange={e=>setPracticalFeedback(e.target.value)}/></label>
        <button disabled={busy||!canGrade} className="border rounded px-4 py-2 mt-2 disabled:opacity-40" onClick={()=>run(()=>reviewCertificationPractical(selected,practical,practicalFeedback),'Practical review saved')}>Save practical assessment</button>
      </div>
      <div className="border rounded bg-white p-4 mb-6"><h2 className="text-xl font-semibold mb-2">Final certificate approval</h2>
        <p className="text-sm mb-3">Issue only if all written answers are graded, theory meets the database pass threshold, and practical is Passed. Issuance records the mentor account and timestamp; this does not generate a printable certificate.</p>
        <button className="bg-amber-500 text-slate-900 font-semibold rounded px-4 py-3 disabled:opacity-40" disabled={busy||current.status!=='graded'||current.practical_status!=='passed'||current.certificate_status==='issued'} onClick={()=>{if(window.confirm('Issue certification to this student? This records official approval.'))run(()=>issueCertification(selected),'Certificate approval recorded')}}>Approve certification</button>
      </div>
    </>}
  </section>
}
