import { supabase } from '../supabaseClient.js';

// --- Auth -------------------------------------------------------------

export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Makes sure a row exists in `students` for the signed-in user.
// Safe to call every time someone logs in.
export async function ensureStudentRow(user) {
  const { error } = await supabase
    .from('students')
    .upsert({ id: user.id, name: user.email }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) console.error('ensureStudentRow failed:', error.message);
}

// --- Content ------------------------------------------------------------

// Fetches one module plus all its chapters, each with its quiz and questions nested.
export async function fetchModuleWithChapters(moduleNumber) {
  const { data: moduleRow, error: moduleErr } = await supabase
    .from('modules')
    .select('*')
    .eq('number', moduleNumber)
    .single();
  if (moduleErr) throw moduleErr;

  const { data: chapters, error: chapErr } = await supabase
    .from('chapters')
    .select('*, quizzes(*, questions(*))')
    .eq('module_id', moduleRow.id)
    .order('number');
  if (chapErr) throw chapErr;

  return { module: moduleRow, chapters };
}

// --- Progress & quiz attempts --------------------------------------------

export async function fetchProgress(studentId) {
  const { data, error } = await supabase.from('progress').select('*').eq('student_id', studentId);
  if (error) throw error;
  // { [chapter_id]: true }
  return Object.fromEntries(data.map((row) => [row.chapter_id, true]));
}

export async function markChapterRead(studentId, chapterId) {
  const { error } = await supabase
    .from('progress')
    .upsert({ student_id: studentId, chapter_id: chapterId, status: 'complete' }, { onConflict: 'student_id,chapter_id' });
  if (error) throw error;
}

export async function fetchQuizAttempts(studentId) {
  const { data, error } = await supabase.from('quiz_attempts').select('*').eq('student_id', studentId);
  if (error) throw error;
  // { [quiz_id]: [score, score, ...] }
  const byQuiz = {};
  for (const row of data) {
    if (!byQuiz[row.quiz_id]) byQuiz[row.quiz_id] = [];
    byQuiz[row.quiz_id].push(row.score);
  }
  return byQuiz;
}

export async function submitQuizAttempt(studentId, quizId, score) {
  const { error } = await supabase.from('quiz_attempts').insert({ student_id: studentId, quiz_id: quizId, score });
  if (error) throw error;
}

// --- Short-answer (written) questions ------------------------------------

export async function fetchWrittenAnswers(studentId) {
  const { data, error } = await supabase.from('written_answers').select('question_id, answer_text, review_status, mentor_feedback, reviewed_at').eq('student_user_id', studentId);
  if (error) throw error;
  // { [question_id]: saved answer text }
  return Object.fromEntries(data.map((row) => [row.question_id, row]));
}

export async function submitWrittenAnswer(studentId, questionId, text) {
  const { error } = await supabase.from('written_answers').insert({ student_user_id: studentId, question_id: questionId, answer_text: text });
  if (error) throw error;
}

// Mentor privileges are established by trusted Auth app_metadata, never by the browser.
export async function hasMentorRole() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.app_metadata?.ftmp_role === 'mentor';
}

export async function fetchMentorWrittenAnswers() {
  const { data, error } = await supabase.from('written_answers')
    .select('id, student_user_id, question_id, answer_text, submitted_at, review_status, mentor_feedback, reviewed_at, questions(prompt, quizzes(title, chapters(number,title, modules(number,title))))')
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function reviewWrittenAnswer(answerId, status, feedback) {
  if (!['reviewed', 'needs_improvement'].includes(status)) throw new Error('Invalid review status');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw authError || new Error('Not signed in');
  const { data, error } = await supabase.from('written_answers')
    .update({ review_status: status, mentor_feedback: (feedback || '').trim() || null, reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id })
    .eq('id', answerId)
    .select('id, review_status, mentor_feedback, reviewed_at');
  if (error) throw error;
  if (!data || data.length !== 1) {
    throw new Error('Review was not saved: Supabase updated no answer row. Verify mentor access and written_answers UPDATE policy.');
  }
  if (data[0].review_status !== status) {
    throw new Error('Review status did not persist as expected.');
  }
  return data[0];
}

// Certification progress is verified server-side on every check.
export async function fetchCertificationEligibility() {
  const { data, error } = await supabase.rpc('ftmp_certification_eligibility');
  if (error) throw error;
  return data;
}
export async function fetchCertificationExam() {
  const { data, error } = await supabase.from('certification_exams').select('id,code,title,is_published').eq('code','FTMP-V1-CERT').maybeSingle();
  if (error) throw error;
  return data;
}
export async function fetchCertificationQuestions(examId) {
  const { data, error } = await supabase.from('certification_questions').select('id,question_number,type,prompt,options,max_marks').eq('exam_id',examId).order('question_number');
  if (error) throw error;
  return data || [];
}
export async function startCertification(examId) {
  const { data, error } = await supabase.rpc('certification_start',{p_exam_id:examId});
  if (error) throw error;
  return data;
}
export async function saveCertificationAnswer(attemptId, question, value) {
  const args={p_attempt_id:attemptId,p_question_id:question.id,p_selected_index:question.type==='mcq'?value:null,p_written_answer:question.type==='short_answer'?value:null};
  const { error }=await supabase.rpc('certification_save_response',args);
  if(error) throw error;
}
export async function submitCertification(attemptId) {
  const {error}=await supabase.rpc('certification_submit',{p_attempt_id:attemptId});
  if(error) throw error;
}
export async function fetchCertificationAttempt(examId,userId) {
  const {data,error}=await supabase.from('certification_attempts').select('id,status').eq('exam_id',examId).eq('student_user_id',userId).maybeSingle();
  if(error) throw error;
  return data;
}
export async function fetchCertificationResponses(attemptId) {
  const {data,error}=await supabase.from('certification_responses').select('question_id,selected_index,written_answer').eq('attempt_id',attemptId);
  if(error) throw error;
  return data || [];
}


// --- Certification mentor operations (read access is restricted by Supabase RLS) ---
export async function fetchCertificationMentorAttempts(){
  const {data,error}=await supabase.from('certification_attempts')
    .select('id,exam_id,student_user_id,status,created_at,submitted_at,graded_at,practical_status,practical_feedback,certificate_status,certificate_issued_at')
    .order('created_at',{ascending:false});
  if(error)throw error; return data||[];
}
export async function fetchCertificationMentorResponses(attemptId){
  const {data,error}=await supabase.from('certification_responses')
    .select('attempt_id,question_id,selected_index,written_answer,awarded_marks,mentor_feedback,reviewed_at,certification_questions(question_number,type,prompt,max_marks)')
    .eq('attempt_id',attemptId);
  if(error)throw error;return (data||[]).sort((a,b)=>(a.certification_questions?.question_number||0)-(b.certification_questions?.question_number||0));
}
export async function gradeCertificationWritten(attemptId,questionId,marks,feedback){
  const {error}=await supabase.rpc('certification_grade_written',{p_attempt_id:attemptId,p_question_id:questionId,p_marks:marks,p_feedback:feedback||null});
  if(error)throw error;
}
export async function reviewCertificationPractical(attemptId,status,feedback){
  const {error}=await supabase.rpc('certification_review_practical',{p_attempt_id:attemptId,p_status:status,p_feedback:feedback||null});
  if(error)throw error;
}
export async function issueCertification(attemptId){
  const {error}=await supabase.rpc('certification_issue',{p_attempt_id:attemptId});
  if(error)throw error;
}


// Final certificate registry operations. Database applies mentor authorization.
export async function issueCertificationNamed(attemptId, holderName) {
  const { data, error } = await supabase.rpc('certification_issue_named', { p_attempt_id: attemptId, p_holder_name: holderName });
  if (error) throw error;
  return data;
}
export async function fetchCertificateForAttempt(attemptId) {
  const { data, error } = await supabase.from('ftmp_certificates')
    .select('certificate_number,holder_name,exam_title,theory_score,issued_at,revoked_at')
    .eq('attempt_id', attemptId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function revokeCertificate(number, reason) {
  const { error } = await supabase.rpc('ftmp_revoke_certificate', { p_certificate_number: number, p_reason: reason });
  if (error) throw error;
}
export async function verifyCertificate(number) {
  const { data, error } = await supabase.rpc('ftmp_verify_certificate', { p_certificate_number: number });
  if (error) throw error;
  return data?.[0] || null;
}
