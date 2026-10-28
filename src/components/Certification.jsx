import React, { useEffect, useState } from 'react';
import { fetchCertificationEligibility, fetchCertificationExam, fetchCertificationQuestions, startCertification, saveCertificationAnswer, submitCertification, fetchCertificationAttempt, fetchCertificationResponses } from '../lib/api.js';

const wordCount = s => (s||'').trim().split(/\s+/).filter(Boolean).length;
export default function Certification({studentId,onBack}) {
 const [savedCount,setSavedCount]=useState(0),[savingProgress,setSavingProgress]=useState('');
 const [elig,setElig]=useState(null),[exam,setExam]=useState(null),[questions,setQuestions]=useState([]),[attempt,setAttempt]=useState(null),[answers,setAnswers]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function reload(){setBusy(true);setError('');try {
  const e=await fetchCertificationEligibility();setElig(e);
  if(e.eligible){const x=await fetchCertificationExam();setExam(x);
   if(x){const q=await fetchCertificationQuestions(x.id);setQuestions(q);
    const a=await fetchCertificationAttempt(x.id,studentId);setAttempt(a);
    if(a){const r=await fetchCertificationResponses(a.id);setSavedCount(r.length);setAnswers(Object.fromEntries(r.map(v=>[v.question_id,v.selected_index!==null?v.selected_index:v.written_answer])));}else{setSavedCount(0);setAnswers({});}
   }}
 }catch(ex){setError(ex.message||String(ex))}finally{setBusy(false)}}
 useEffect(()=>{reload()},[studentId]);
 async function begin(){setBusy(true);setError('');try{const id=await startCertification(exam.id);setAttempt({id,status:'in_progress'});}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function save(q){setBusy(true);setError('');setMessage('');try{const v=answers[q.id];if(v===undefined||v===null||(q.type==='short_answer'&&!String(v).trim()))throw Error('Please answer this question first');if(q.type==='short_answer'&&wordCount(v)>100)throw Error('Maximum 100 words');await saveCertificationAnswer(attempt.id,q,v);const r=await fetchCertificationResponses(attempt.id);setSavedCount(r.length);setMessage(`Question ${q.question_number} saved`);}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function finish(){
  if(!attempt || attempt.status!=='in_progress')return;
  if(questions.length!==50){setError(`Expected 50 questions but loaded ${questions.length}. Please refresh and report the issue.`);return;}
  const missing=questions.filter(q=>{const v=answers[q.id];return q.type==='mcq'? !Number.isInteger(v): !String(v??'').trim()});
  if(missing.length){setError(`Please answer all 50 questions before submitting. Missing: ${missing.map(q=>'Q'+q.question_number).join(', ')}.`);return;}
  const tooLong=questions.filter(q=>q.type==='short_answer'&&wordCount(answers[q.id])>100);
  if(tooLong.length){setError(`Written answers exceed 100 words: ${tooLong.map(q=>'Q'+q.question_number).join(', ')}`);return;}
  if(!window.confirm('Save and submit all 50 answers? This is final and cannot be undone.'))return;
  setBusy(true);setError('');setMessage('');
  try{
    // Never submit before every response is persisted to Supabase.
    for(let i=0;i<questions.length;i++){
      const q=questions[i];setSavingProgress(`Saving answer ${i+1} of ${questions.length}…`);
      await saveCertificationAnswer(attempt.id,q,answers[q.id]);
    }
    const persisted=await fetchCertificationResponses(attempt.id);
    setSavedCount(persisted.length);
    if(persisted.length!==questions.length)throw Error(`Only ${persisted.length} of ${questions.length} answers were saved. Submission has been stopped; retry after checking the connection.`);
    setSavingProgress('Finalizing certification submission…');
    await submitCertification(attempt.id);
    await reload();
    setMessage('All 50 answers submitted successfully. This attempt is now locked for mentor evaluation.');
  }catch(e){setError(`Submission not completed: ${e.message||String(e)}. Saved answers remain available; retry submitting.`)}
  finally{setSavingProgress('');setBusy(false)}
}
 return <div className="max-w-3xl" style={{color:'#16213E'}}>
 <button onClick={onBack} className="mb-4 text-sm underline">← Back to modules</button>
 <h1 className="text-3xl font-semibold mb-2">Volume 1 — Final Certification</h1>
 <p className="text-sm mb-4">Certification requires course completion, a theory examination and a separate practical trading assessment.</p>
 {error&&<p role="alert" className="mb-3 text-red-700">{error}</p>}{message&&<p className="mb-3 text-green-800">{message}</p>}{savingProgress&&<p role="status" className="mb-3 text-blue-800">{savingProgress}</p>}
 {!elig?<p>Checking eligibility…</p>:<div className="bg-white border rounded p-4 mb-5">
  <p><b>Chapters manually marked Read:</b> {elig.chapters_read} / {elig.chapters_total}</p>
  <p><b>Quizzes and module assessments completed:</b> {elig.quizzes_complete} / {elig.quizzes_total}</p>
  <p className="mt-2"><b>{elig.eligible?'Eligible':'Locked'}</b>{elig.mentor?' — mentor access':''}</p>
  {!elig.eligible&&<p className="text-sm mt-2">Complete all 82 chapters, all available chapter quizzes and all eight module assessments to unlock the examination. Written responses may await mentor review.</p>}
  <button onClick={reload} disabled={busy} className="border rounded px-3 py-2 mt-3">Refresh progress</button>
 </div>}
 {elig?.eligible&&(!exam?<p>{elig.mentor?'No exam record found. Check the SQL import.':'The examination is not published yet.'}</p>:<>
  {elig.mentor&&!exam.is_published&&<p className="mb-3">Mentor preview: questions are visible before publication. Student access remains locked.</p>}
  {attempt?.status==='in_progress'&&<p className="mb-3 text-sm">Saved to Supabase: {savedCount} / {questions.length} answers. Selecting an option is not a submission; use the final button to save and submit all answers together.</p>}
  {!attempt?<button onClick={begin} disabled={busy||!exam.is_published&&!elig.mentor} className="bg-yellow-500 px-4 py-2 rounded">Start Certification Examination</button>:<p className="mb-3 font-semibold">Attempt status: {attempt.status}</p>}
  {(elig.mentor||attempt)&&<div className="space-y-4">{questions.map(q=><div key={q.id} className="bg-white border rounded p-4">
   <p className="font-semibold mb-2">{q.question_number}. {q.prompt} <span className="font-normal text-sm">({q.max_marks} marks)</span></p>
   {q.type==='mcq'?(q.options||[]).map((opt,i)=><label key={i} className="flex gap-2 mb-2"><input type="radio" name={q.id} checked={answers[q.id]===i} disabled={!attempt||attempt.status!=='in_progress'} onChange={()=>setAnswers(a=>({...a,[q.id]:i}))}/>{opt}</label>):<><textarea rows={4} className="w-full border p-2 rounded" placeholder="Answer in your own words (maximum 100 words)" value={answers[q.id]||''} disabled={!attempt||attempt.status!=='in_progress'} onChange={e=>{if(wordCount(e.target.value)<=100)setAnswers(a=>({...a,[q.id]:e.target.value}))}}/><p className="text-xs">{wordCount(answers[q.id])}/100 words</p></>}
   {attempt?.status==='in_progress'&&<button className="border px-3 py-1 rounded mt-2" disabled={busy} onClick={()=>save(q)}>Save answer</button>}
  </div>)}
  {attempt?.status!=='in_progress'&&attempt&&<p className="bg-green-50 p-3 rounded font-semibold">This examination has already been submitted. Retakes require academy approval.</p>}
  {attempt?.status==='in_progress'&&<button disabled={busy||questions.length!==50} onClick={finish} className="bg-yellow-500 font-semibold px-5 py-3 rounded">Submit all 50 answers</button>}
  </div>}
 </>)}
 </div>;
}
