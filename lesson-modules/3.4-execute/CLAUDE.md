# 3.4 Execute

This is the payoff. Fresh subagents building your app.

Each agent gets a clean 200k context, executes its plan, commits its work. Agents run in waves - independent tasks in parallel, dependent tasks wait.

You'll see agents spawn and complete in your terminal.

STOP: Ready to execute Phase 1?

USER: Yes

---

## Before You Run It

**This is the build step - it takes 10-15 minutes.**

Fresh agents will:
1. Read their PLAN.md files
2. Write actual code
3. Verify it works
4. Commit to git

Each wave runs, then the next. You'll see progress in the terminal.

**When it finishes**, you'll see "PHASE 1 COMPLETE" and be back at the normal prompt.

STOP: What will you type when you're back at the normal prompt?

USER: Done

Right - you'll type "done" so we can look at what got built.

---

## Run It

Type `/gsd:execute-phase 1` and hit enter.

Watch the terminal. Each agent reads its PLAN.md, implements the code, verifies it works, commits. Let it run until all agents finish.

This is the longest step - **10-15 minutes**. Grab a coffee. When you see "PHASE 1 COMPLETE" and you're back at the normal prompt, type "done".

STOP: Run `/gsd:execute-phase 1` now. Type "done" when all agents finish.

USER: Done

---

## What Just Happened

Let's recap what GSD did.

GSD spawned fresh subagents for each plan. Wave 1 ran first. Wave 2 waited for Wave 1 to finish, then ran. And so on.

Each agent had a full 200k context - no degradation from the first to the last. Each task got an atomic git commit. Your main session stayed clean the whole time.

STOP: See how different that is from one long Claude session?

USER: Yes

---

## Check the Git History

ACTION: Run `git log --oneline -10` and show the commits

Each task got its own commit. The format is usually something like `feat(01-01): description` or `feat(01-02): description`.

This means you can:
- **Git bisect** to find exactly which task broke something
- **Revert individual tasks** without losing other work
- **See a clear history** of what was built when

STOP: Pretty clean history, right?

USER: Yes

---

## See Your App Running

Let's see what got built.

ACTION: Run `npm run dev` (or the appropriate dev command) to start the app

ACTION: Tell the student the URL (usually http://localhost:5173 for Vite)

Open that in your browser. You should see your Expense Splitter - at least the Phase 1 foundation.

STOP: Do you see the app running?

USER: Yes / [Issues]

[If issues: That's sometimes normal for first builds. Let's check what's there and continue. We'll verify more thoroughly in the next lesson.]

---

## What Phase 1 Built

**Important context:** This is Phase 1 only - the foundation.

You can add people and items. That's what Phase 1 delivers.

The full app requires Phase 2 (splitting logic, tip calculation, final summary) and Phase 3 (mobile polish). Those are still in your roadmap, ready to build.

You could keep building right now with `/gsd:plan-phase 2` and `/gsd:execute-phase 2`. Or you can finish this module first to learn verification and quick mode.

STOP: Make sense that this is Phase 1 of a multi-phase build?

USER: Yes

---

## The Summary Files

GSD also created summary files for each executed plan.

ACTION: Show the SUMMARY.md files in the phase folder

These track what was actually built, decisions made, any deviations from the plan. Useful for understanding what happened, especially if you come back to this project later.

STOP: Make sense?

USER: Yes

---

## Recap

Phase 1 is built. You have a working Expense Splitter foundation.

Fresh subagents kept quality high from first task to last. Atomic commits give you clean, traceable git history. And your roadmap is ready for Phase 2 whenever you are.

Next, we verify everything works and learn about quick mode and when to use GSD.

STOP: Ready to verify? Type `/start-3-5` to continue.

USER: Ready

---

## Important Notes for Claude

- Execution time varies significantly based on number of plans
- If an agent fails mid-execution, GSD usually provides error info
- The app may not be fully functional yet - that's what verification is for
- Git history won't exist if they didn't have git initialized (GSD usually handles this)
- **After "done"**: ALWAYS do the full debrief:
  1. Show git log
  2. Run the dev server
  3. Tell them the URL to open
  4. Explain this is Phase 1 only - full app needs Phases 2 and 3
  5. Show the SUMMARY.md files
- Don't let the student wonder "where's my app?" - proactively show them

## Success Criteria

- [ ] Student ran /gsd:execute-phase 1 successfully
- [ ] Agents completed execution
- [ ] Student saw the git history with atomic commits
- [ ] App is running and student can see it in browser
- [ ] Student understands this is Phase 1 - foundation only
- [ ] Student knows Phase 2 and 3 are ready to build when they want
- [ ] Student saw the SUMMARY.md files
- [ ] Student understands the fresh context advantage
