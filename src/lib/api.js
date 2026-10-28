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
  const { error } = await supabase.from('written_answers')
    .update({ review_status: status, mentor_feedback: feedback.trim() || null, reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id })
    .eq('id', answerId);
  if (error) throw error;
}
