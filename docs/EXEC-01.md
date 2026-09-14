# EXEC-01: Scaffold BYOB-fit (v1.0, Sep 12, 2026)

You are the execution pipeline for BYOB-fit. Implement the numbered tasks below exactly. Do not restyle, improve, add dependencies beyond what a task names, or extend scope. Where a task says "must print", capture the real command output for the report. If any step would delete files, touch `main`, or needs a choice not covered here, STOP and ask before continuing.

Working directory: `~/Code/BYOB-fit`. Language: TypeScript.

## Tasks

1. Sync and branch. Run `git pull`. Confirm `git status` shows a clean tree on `main`. Create and switch to a branch named `setup`.

2. Scaffold. Run `npm create vite@latest . -- --template react-ts` in the repo root. If it warns the directory is not empty, choose the option that ignores existing files and continues; never the option that removes them. After scaffolding, `README.md` and `LICENSE` must still be the versions committed in git (check with `git diff --stat`; if the scaffold overwrote README.md, restore it with `git checkout -- README.md`). Then run `npm install`.

3. Ignore rules. Open the `.gitignore` the scaffold created. Ensure these lines exist (add any missing, keep the rest):
   ```
   node_modules
   dist
   seed/program.json
   .env
   .env.*
   ```
   Create the folder `seed/` containing one file, `seed/README.md`, with this text:
   ```
   Private seed data. Put your own program at seed/program.json; it is gitignored and never committed. A generic sample lives at public/sample-program.json.
   ```
   Verify: `git check-ignore -v seed/program.json` must print a line naming `.gitignore`.

4. Pages base path. In `vite.config.ts`, set `base: '/BYOB-fit/'` inside `defineConfig`.

5. Hello page. Replace the scaffold's `src/App.tsx` with a component that renders only: an `h1` reading `BYOB-fit`, a `p` reading `Build Your Own Body`, and a `p` reading `v0.0.1`. Delete `src/assets/react.svg`, `public/vite.svg`, and the contents of `src/App.css` and `src/index.css` (leave the files present and empty). Remove the logo imports and any other references to the deleted files so the build has no warnings. Set the `<title>` in `index.html` to `BYOB-fit`.

6. Deploy workflow. Create `.github/workflows/deploy.yml` that, on push to `main`, checks out the repo, sets up Node 24, runs `npm ci` and `npm run build`, uploads `dist` as the Pages artifact, and deploys it with the official `actions/deploy-pages` action, using the permissions and environment that action requires. Do not trigger it: no push to `main`.

7. Folders. Create `docs/.gitkeep` and `design/.gitkeep`. Files will be placed there by the owner later.

8. Build check. `npm run build` must succeed with exit code 0. Then start `npm run dev`, confirm it reports a local URL, and stop it.

9. Commit and push. Stage everything, commit on `setup` with the message `Scaffold: Vite React TS, Pages workflow, seed ignore rules`, and push the branch with `git push -u origin setup`. Do not merge. Do not open a pull request.

## Report

Reply with one line per task, numbered 1 to 9, each ending in PASS or FAIL, with the evidence line for tasks 3 (the check-ignore output), 8 (the last lines of the build output), and 9 (the push output). Then list every decision you made that a task did not cover, however small. Finish by pasting the raw output of `git log --oneline -3` and `git status`.
