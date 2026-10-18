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
