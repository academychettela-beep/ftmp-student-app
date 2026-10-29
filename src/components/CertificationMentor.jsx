import React, { useEffect, useMemo, useState } from 'react';
import { fetchCertificationMentorAttempts, fetchCertificationMentorResponses, gradeCertificationWritten, reviewCertificationPractical, issueCertificationNamed, fetchCertificateForAttempt, revokeCertificate, verifyCertificate } from '../lib/api.js';


// Print in a standalone document so the app's hidden layout does not create blank pages.
function printCertificate(certificate) {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const popup = window.open('', '_blank', 'width=1100,height=820');
  if (!popup) {
    window.alert('Please allow pop-ups for this site to print your certificate.');
    return;
  }
  const date = new Date(certificate.issued_at).toLocaleDateString();
  const logo = `${window.location.origin}${import.meta.env.BASE_URL}cfa-logo.svg`;
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>FTMP Certificate - ${escapeHtml(certificate.certificate_number)}</title>
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #10253b; }
.certificate { width: 297mm; height: 210mm; padding: 15mm; border: 9mm solid white; outline: 2mm double #a88743; outline-offset: -12mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; overflow: hidden; position:relative; }
.academy { font: bold 23px Arial, sans-serif; letter-spacing: 2px; position:relative; z-index:1; }
.brandmark { width: 135px; height:auto; max-height:120px; object-fit:contain; position:relative; z-index:1; }
.watermark { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width: 540px; max-width:80%; opacity:.20; z-index:0; pointer-events:none; }
.certificate > div:not(.watermark) {position:relative; z-index:1;}
.signature-area { align-self:flex-end; width:240px; text-align:center; margin-top:20px; font:12px Arial,sans-serif; position:relative; z-index:1; }
.signature-line { border-bottom:1px solid #293f58; height:27px; margin-bottom:6px; }
.signature-name {font-weight:700; font-size:13px;}
.signature-role {font-size:11px; margin-top:3px;}
.motto { font: 12px Arial, sans-serif; letter-spacing: 3px; margin-top: 10px; }
.title { font-size: 36px; margin: 36px 0 7px; }
.subtitle { font: 17px Arial, sans-serif; }
.presented { margin-top: 35px; font: 15px Arial, sans-serif; }
.name { font-size: 37px; font-weight: bold; margin: 18px 0; }
.statement { font: 16px/1.5 Arial, sans-serif; max-width: 810px; }
.details { margin-top: 38px; font: 13px Arial, sans-serif; }
.disclaimer { margin-top: 18px; font: 11px Arial, sans-serif; }
@media screen { body { display: flex; justify-content: center; background: #e8e8e8; padding: 12px; } .certificate { background: white; box-shadow: 0 6px 20px #aaa; } }
@media print { .certificate { break-inside: avoid; page-break-inside: avoid; } }
</style></head><body><main class="certificate">
<img class="watermark" src="${logo}" alt="" /><img class="brandmark" src="${logo}" alt="CFA logo" /><div class="academy">THE CHETTELA FOREX ACADEMY</div><div class="motto">KNOWLEDGE BEFORE PROFIT</div>
<div class="title">Certificate of Foundation Completion</div>
<div class="subtitle">Forex Trading Mastery Program · Volume 1</div>
<div class="presented">This certificate is presented to</div>
<div class="name">${escapeHtml(certificate.holder_name)}</div>
<div class="statement">For completing the Volume 1 theory examination and passing the supervised demo-account practical evaluation.</div>
<div class="details">Certificate No. ${escapeHtml(certificate.certificate_number)} · Issued ${escapeHtml(date)}</div>
<div class="signature-area"><div class="signature-line"></div><div class="signature-name">Authorized Signatory</div><div class="signature-role">Founder &amp; Mentor · Chettela Forex Academy</div></div><div class="disclaimer">Foundational training and assessed practice, not a guarantee of profit or professional accreditation.</div>
</main></body></html>`);
  popup.addEventListener('load', () => { popup.focus(); popup.print(); }, { once: true });
  popup.document.close();
}

export default function CertificationMentor({onBack}) {
  const [attempts,setAttempts]=useState([]),[selected,setSelected]=useState(''),[responses,setResponses]=useState([]);
  const [drafts,setDrafts]=useState({}),[practical,setPractical]=useState('pending'),[practicalFeedback,setPracticalFeedback]=useState('');
  const [holderName,setHolderName]=useState(''),[certificate,setCertificate]=useState(null),[revokeReason,setRevokeReason]=useState('');
  const [verifyNumber,setVerifyNumber]=useState(''),[verification,setVerification]=useState(null),[verifyBusy,setVerifyBusy]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const current=attempts.find(a=>a.id===selected);
  async function reloadAttempts(){const a=await fetchCertificationMentorAttempts();setAttempts(a);return a;}
  async function loadResponses(id){const r=await fetchCertificationMentorResponses(id);setResponses(r);setDrafts(Object.fromEntries(r.filter(x=>x.certification_questions?.type==='short_answer').map(x=>[x.question_id,{marks:x.awarded_marks===null?'':String(x.awarded_marks),feedback:x.mentor_feedback||''}])));}
  useEffect(()=>{(async()=>{try{await reloadAttempts();}catch(e){setError(e.message)}})()},[]);
  useEffect(()=>{if(!selected){setResponses([]);return;}setError('');loadResponses(selected).catch(e=>setError(e.message));const a=attempts.find(x=>x.id===selected);setPractical(a?.practical_status||'pending');setPracticalFeedback(a?.practical_feedback||'');setCertificate(null);fetchCertificateForAttempt(selected).then(setCertificate).catch(e=>setError(e.message));},[selected]);
  const gradedCount=responses.filter(r=>r.awarded_marks!==null).length;
  const total=responses.reduce((n,r)=>n+(r.awarded_marks||0),0);
  const mcq=responses.filter(r=>r.certification_questions?.type==='mcq').reduce((n,r)=>n+(r.awarded_marks||0),0);
  const short=responses.filter(r=>r.certification_questions?.type==='short_answer').reduce((n,r)=>n+(r.awarded_marks||0),0);
  async function run(fn,done){setBusy(true);setError('');setNotice('');try{await fn();const a=await reloadAttempts();if(selected){await loadResponses(selected);setCertificate(await fetchCertificateForAttempt(selected));}setNotice(done);}catch(e){setError(e.message||String(e))}finally{setBusy(false)}}
  const canGrade=current&&['submitted','graded'].includes(current.status)&&current.certificate_status!=='issued'&&!certificate;
  return <section className="max-w-4xl mx-auto text-slate-900">
    <button onClick={onBack} className="mb-4 underline text-sm">← Back to modules</button>
    <h1 className="text-3xl font-semibold">Certification — Mentor Review</h1>
    <p className="my-3 text-sm">Theory: 20 MCQs scored automatically, 30 written answers graded here. Practical result is separate. Certificates require an explicit mentor decision.</p>
    {error&&<p role="alert" className="bg-red-50 text-red-800 p-3 mb-3 rounded">{error}</p>}
    {notice&&<p role="status" className="bg-green-50 text-green-800 p-3 mb-3 rounded">{notice}</p>}
    <div className="border rounded bg-white p-4 mb-5">
      <h2 className="text-xl font-semibold mb-2">Verify a certificate number</h2>
      <p className="text-sm mb-3">Read-only verification. This does not modify or revoke a certificate.</p>
      <form onSubmit={async e=>{e.preventDefault();setVerification(null);setVerifyBusy(true);try{const result=await verifyCertificate(verifyNumber.trim().toUpperCase());setVerification(result||{verification_status:'not_found'});}catch(err){setVerification({verification_status:'error',message:err.message||String(err)});}finally{setVerifyBusy(false);}}} className="flex gap-2 flex-wrap">
        <input aria-label="Certificate number" className="border rounded p-2 flex-1 min-w-48" value={verifyNumber} maxLength={60} placeholder="CFA-FTMP-V1-0001001" onChange={e=>{setVerifyNumber(e.target.value);setVerification(null);}} />
        <button type="submit" disabled={verifyBusy||!verifyNumber.trim()} className="bg-slate-800 text-white rounded px-4 py-2 disabled:opacity-40">{verifyBusy?'Checking…':'Verify'}</button>
      </form>
      {verification&&<div role="status" className="mt-3 p-3 rounded bg-slate-50">
        <p><b>Status:</b> {verification.verification_status==='valid'?'VALID':verification.verification_status==='revoked'?'REVOKED':verification.verification_status==='not_found'?'NOT FOUND':'ERROR'}</p>
        {verification.holder_name&&<p><b>Holder:</b> {verification.holder_name}</p>}
        {verification.certificate_number&&<p><b>Number:</b> {verification.certificate_number}</p>}
        {verification.exam_title&&<p><b>Program:</b> {verification.exam_title}</p>}
        {verification.issued_at&&<p><b>Issued:</b> {new Date(verification.issued_at).toLocaleDateString()}</p>}
        {verification.message&&<p className="text-red-800">{verification.message}</p>}
      </div>}
    </div>
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
        <button disabled={busy||!canGrade||!!certificate} className="border rounded px-4 py-2 mt-2 disabled:opacity-40" onClick={()=>run(()=>reviewCertificationPractical(selected,practical,practicalFeedback),'Practical review saved')}>Save practical assessment</button>
      </div>
      <div className="border rounded bg-white p-4 mb-6"><h2 className="text-xl font-semibold mb-2">Final certificate approval</h2>
        <p className="text-sm mb-3">Issue only after all 50 responses are graded, theory reaches 70/100, and practical is passed. The student name and certificate number are recorded.</p>
        <label className="block mb-3">Verified certificate holder name<input className="block w-full mt-1 border rounded p-2" maxLength={120} value={holderName} disabled={busy||!!certificate} onChange={e=>setHolderName(e.target.value)} /></label>
        <button className="bg-amber-500 text-slate-900 font-semibold rounded px-4 py-3 disabled:opacity-40" disabled={busy||current.status!=='graded'||current.practical_status!=='passed'||current.certificate_status==='issued'||!!certificate||total<70||gradedCount!==50||holderName.trim().length<2} onClick={()=>{if(window.confirm('Issue an official certificate to this student?'))run(()=>issueCertificationNamed(selected,holderName.trim()),'Certificate issued')}}>Approve certification</button>
      </div>
      {certificate&&<div className="border rounded bg-white p-5 mb-6">
        <h2 className="text-xl font-semibold mb-2">Certificate record</h2>
        <p><b>Certificate number:</b> {certificate.certificate_number}</p>
        <p><b>Holder:</b> {certificate.holder_name}</p>
        <p><b>Status:</b> {certificate.revoked_at?'Revoked':'Valid'}</p>
        <div id="ftmp-print-certificate" className="relative border-4 border-double border-amber-600 text-center p-9 my-4 bg-white overflow-hidden" style={{color:'#10253b'}}>\n          <img src={`${import.meta.env.BASE_URL}cfa-logo.svg`} alt="" className="absolute inset-0 m-auto w-3/5 pointer-events-none" style={{opacity:0.20}} />\n          <div className="relative">\n          <img src={`${import.meta.env.BASE_URL}cfa-logo.svg`} alt="CFA logo" className="mx-auto w-40 h-auto mb-3" />
          <p className="text-2xl font-bold tracking-widest">THE CHETTELA FOREX ACADEMY</p>
          <p className="text-sm tracking-widest mt-1">KNOWLEDGE BEFORE PROFIT</p>
          <div className="my-10"><p className="text-4xl font-serif font-bold">Certificate of Foundation Completion</p><p className="mt-2 text-lg">Forex Trading Mastery Program · Volume 1</p></div>
          <p>This certificate is presented to</p><p className="text-3xl font-serif font-bold my-5">{certificate.holder_name}</p>
          <p>For completing the Volume 1 theory examination and passing the supervised demo-account practical evaluation.</p>
          <p className="text-sm mt-8">Certificate No. {certificate.certificate_number} · Issued {new Date(certificate.issued_at).toLocaleDateString()}</p>
          <div className="mt-8 ml-auto w-60 text-center"><div className="border-b border-slate-700 h-10"></div><p className="mt-2 font-semibold">Authorized Signatory</p><p className="text-xs">Founder & Mentor · Chettela Forex Academy</p></div>\n          <p className="text-xs mt-5">Foundational training and assessed practice, not a guarantee of profit or professional accreditation.</p>\n          </div>
        </div>
        {!certificate.revoked_at&&<button className="border rounded px-4 py-2 my-3" onClick={()=>printCertificate(certificate)}>Print / Save as PDF</button>}
        {!certificate.revoked_at&&<div className="mt-3"><label>Revocation reason (minimum 10 characters)<textarea className="border p-2 rounded block w-full" value={revokeReason} onChange={e=>setRevokeReason(e.target.value)}/></label>
        <button disabled={busy||revokeReason.trim().length<10} className="bg-red-800 text-white rounded px-3 py-2 mt-2 disabled:opacity-40" onClick={()=>{if(window.confirm('Revoke this certificate?'))run(()=>revokeCertificate(certificate.certificate_number,revokeReason),'Certificate revoked')}}>Revoke certificate</button></div>}
      </div>}
    </>}
  </section>
}
