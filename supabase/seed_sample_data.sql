-- Optional: run this after schema.sql to load two sample chapters, so you
-- can test the full pipeline (sign up, read, quiz, retake, progress) before
-- your real Module 1 content is ready. Safe to delete these rows later once
-- real content is loaded -- just delete the module row and cascades handle
-- the rest.

insert into modules (id, number, title) values
  ('11111111-1111-1111-1111-111111111111', 1, 'Foundations of Market Structure');

insert into chapters (id, module_id, number, title, content) values
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1,
   'What Is Market Structure?',
   'Market structure describes the pattern price leaves behind as it moves: a sequence of highs and lows that reveals whether a market is trending, ranging, or reversing.

Traders read this pattern before anything else, because every other tool is interpreted through the lens of the structure it appears in.'),
  ('21111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 2,
   'Support and Resistance Basics',
   'Support is a price level where buying pressure has historically overcome selling pressure; resistance is the reverse.

These levels are best treated as zones, not exact lines -- price often reacts within a small range around them.');

insert into quizzes (id, chapter_id, title) values
  ('31111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'Chapter 1 Quiz'),
  ('31111111-1111-1111-1111-111111111112', '21111111-1111-1111-1111-111111111112', 'Chapter 2 Quiz');

insert into questions (quiz_id, type, prompt, options, correct_index) values
  ('31111111-1111-1111-1111-111111111111', 'mcq',
   'A market making a series of higher highs and higher lows is in what kind of structure?',
   '["A downtrend", "An uptrend", "A range", "A reversal"]', 1),
  ('31111111-1111-1111-1111-111111111111', 'mcq',
   'What typically signals the earliest sign of a potential trend change?',
   '["A new all-time high", "A break of structure", "A round number", "Increased volume alone"]', 1),
  ('31111111-1111-1111-1111-111111111112', 'mcq',
   'Support and resistance levels are best thought of as:',
   '["Exact prices", "Zones", "Indicators", "Candlestick patterns"]', 1);
