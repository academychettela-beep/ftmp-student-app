# FTMP Student App

Reading + quiz + progress-tracking app for the Forex Trading Mastery Program,
built to run on $0: GitHub Pages hosts the app, Supabase hosts the database
and student logins.

Right now it's loaded with two placeholder chapters (see
`supabase/seed_sample_data.sql`) so you can test the whole flow before
swapping in real Module 1 content.

## One-time setup

**1. Create a Supabase project**
- Go to supabase.com, sign up free (no card needed), and create a new project.
- Once it's ready, open the **SQL Editor** and run everything in
  `supabase/schema.sql` — this creates all the tables and locks content
  behind login.
- Optionally also run `supabase/seed_sample_data.sql` to load the two sample
  chapters for testing.
- Go to **Project Settings -> API** and copy the **Project URL** and the
  **anon public** key. You'll need both in the next steps.

**2. Create a GitHub repo**
- Go to github.com, sign up free if you don't have an account.
- Create a new **public** repository (public is required for free Pages
  hosting) named `ftmp-student-app`.
- Upload everything in this folder to that repo (drag-and-drop on
  github.com works fine, or ask me to push it for you if you'd rather).

**3. Add your Supabase keys as GitHub secrets**
So the live site can talk to your database without the keys sitting in
public code:
- In your repo, go to **Settings -> Secrets and variables -> Actions**.
- Add two repository secrets:
  - `VITE_SUPABASE_URL` -> your Project URL from step 1
  - `VITE_SUPABASE_ANON_KEY` -> your anon public key from step 1

**4. Turn on GitHub Pages**
- In your repo, go to **Settings -> Pages**.
- Under **Source**, choose **GitHub Actions**.
- Push (or upload) any change to the `main` branch — the included workflow
  (`.github/workflows/deploy.yml`) will build and publish automatically.
  Watch progress under the **Actions** tab; when it's green, your site is
  live at the URL shown in Settings -> Pages.

**5. Check the base path**
`vite.config.js` currently assumes your repo is named `ftmp-student-app`. If
you name it something else, update the `base` value in that file to match
(see the comment inside it) before pushing.

## Trying it locally first (optional)

If you or I want to preview changes before pushing, with Node.js installed:

```
npm install
cp .env.example .env   # then fill in your Supabase URL/key
npm run dev
```

## Loading real Module 1 content

`supabase/schema.sql` defines the shape everything lives in. The
placeholder rows in `seed_sample_data.sql` show the pattern — once your real
chapter text and quiz bank (from your compiler's block data and the Excel
quiz workbooks) are ready to convert, I can generate the equivalent `insert`
statements for all of Module 1 directly from those files.

## Known limitation, worth knowing now rather than later

Quiz answer keys are stored in the `questions` table, which any signed-in
student's browser can technically query directly (not shown in the
interface, but visible to someone who inspects network requests). Fine for
a first version with a small, trusted cohort. If that ever needs to be
airtight, the fix is moving grading into a server-side function that never
sends `correct_index` to the browser at all — worth a dedicated session
when you're ready for it.
