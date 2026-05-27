# 3.1 What is GSD

Welcome to the GSD module! We're leveling up from basic vibecoding to something more powerful.

You've built things with Claude Code before. Maybe you've noticed something though...

STOP: Ever had Claude start strong then get worse as the session goes on? Like it's rushing, cutting corners, forgetting things you told it earlier?

USER: Yes / Definitely

---

That's called "context rot." It's not your imagination - Claude's quality actually drops as the context window fills up.

Here's the rough breakdown:
- **0-30% context:** Peak quality. Thorough, comprehensive, remembers everything.
- **50%+:** Starts rushing. "I'll be more concise." Cuts corners.
- **70%+:** Hallucinations. Forgotten requirements. Drift.

This is why complex projects fall apart halfway through. Basic vibecoding works for simple stuff, but it doesn't scale.

STOP: Make sense why this happens?

USER: Yes

---

## Quick Check

Before we continue - have you completed **Module 2: Vibe Coding**?

That module teaches the basics of building with Claude Code. GSD builds on those skills. If you haven't done it, I'd strongly recommend completing it first - you'll appreciate GSD much more once you've felt the limitations of basic vibecoding.

If you're already comfortable with vibecoding and have a GitHub account set up, you're good to continue.

STOP: Ready to continue, or want to do Module 2 first?

USER: Ready to continue / Already familiar

---

## The GSD Solution

GSD solves context rot with a clever trick: **fresh subagent contexts**.

Instead of one long session that gradually degrades, GSD spawns fresh Claude instances for each task. Each subagent gets a clean 200,000 token context window.

Think about that. Task 50 has the *same quality* as Task 1. No degradation.

Meanwhile, your main session stays at 30-40% context while agents do the heavy lifting.

STOP: That's the core insight - fresh contexts instead of one degrading session. Questions?

USER: No / Makes sense

[If questions, answer them, then continue]

---

## What We're Building in This Module

GSD has a lot of commands and features. The best way to learn it is to build something real.

We're going to build an actual app using GSD from start to finish. By the end of this module, you'll understand the full workflow and be ready to use GSD on your own projects.

But first - let me show you the roadmap so you know what to expect.

---

## Module Roadmap

This module has 5 lessons. Here's the full sequence:

| Lesson | Command | What It Does |
|--------|---------|--------------|
| 3.1 | (this one) | Understand GSD, install it |
| 3.2 | `/gsd:new-project` | GSD interviews you, researches, creates roadmap |
| 3.3 | `/gsd:plan-phase 1` | Breaks phase into atomic task plans |
| 3.4 | `/gsd:execute-phase 1` | Fresh agents build the code |
| 3.5 | `/gsd:verify-work 1` | QA walkthrough, learn quick mode |

**Important time expectation:** This module takes about **45-60 minutes total**. About 30 minutes of that is GSD doing work - researching, planning, building - while you wait.

That's intentional. That's how we build quality software. Grab a coffee during the long steps. The waiting is a feature, not a bug.

STOP: Make sense? Any questions about the overall flow?

USER: Makes sense / Ready

---

## Let's Test Your Understanding

Before we dive in, let me check you understand the workflow.

STOP: What do you think is the first step when starting a new project with GSD?

USER: Start a project / new-project / Setup

Right - `/gsd:new-project`. It interviews you about what you want to build.

STOP: And then what comes next? Planning or building?

USER: Planning

Exactly - you plan before you execute. `/gsd:plan-phase` breaks your roadmap into small, atomic tasks.

STOP: And then?

USER: Execute / Build

Yes - `/gsd:execute-phase` spawns fresh agents to build. Then `/gsd:verify-work` to confirm it works.

Great - you've got the sequence: **new-project → plan-phase → execute-phase → verify-work**.

---

## The Project: Expense Splitter

Now let's see what we're building.

Open `PROJECT_BRIEF.md` in this folder. That's our starting spec.

This is the kind of thing you might have brainstormed with Claude already - a rough idea of what you want to build.

Here's what the app does:
- **Add people** to the bill (Sarah, Mike, Jenny...)
- **Add items** from the receipt with prices
- **Assign who had what** - including shared items like appetizers
- **Handle tip** - choose percentage, split equally or proportionally
- **Handle tax** - same options
- **Show the final breakdown** - "Sarah owes $34.50, Mike owes $28.20..."

STOP: You can probably see why this would be complex - lots of logic, edge cases, multiple UI components. The kind of thing where an AI could easily lose track halfway through. Make sense?

USER: Yes

---

This is exactly the kind of project where basic vibecoding falls apart.

Multiple components that need to work together. Real calculation logic with edge cases. State management across the UI.

GSD will keep quality high from the first task to the last.

STOP: Ready to install GSD?

USER: Yes

---

## Installing GSD

One command to install. You'll need to run this in a **separate terminal window** (not in this Claude Code session).

Open a new terminal and run:

```
npx get-shit-done-cc
```

It'll ask you a couple questions:
- Choose **Claude Code** when it asks about runtime
- Choose **install globally** when it asks about location

STOP: Run `npx get-shit-done-cc` in a separate terminal now. Let me know when it's done.

USER: Done

---

**Important:** Claude Code needs to restart to pick up the new GSD commands.

Type `exit` to close this session, then run:

```
claude --resume
```

This will bring you back to this exact conversation with the new commands available.

STOP: Exit and resume now. Type "I'm back" when you're back in this session.

USER: I'm back / Done

---

Let's verify GSD is installed. Type `/gsd:help` and hit enter.

STOP: Do you see a list of GSD commands?

USER: Yes

---

## What `/gsd:new-project` Will Do

In the next lesson, you'll run `/gsd:new-project`. Here's what to expect:

**The Interview (~3-5 minutes)**
- GSD asks about your project vision
- You describe the Expense Splitter (use PROJECT_BRIEF.md as reference)
- GSD clarifies features, tech preferences, scope

**The Research Phase (~5-10 minutes)**
- GSD spawns up to 3 research subagents in parallel:
  - **Stack researcher** - best tech choices
  - **Features researcher** - common patterns and must-haves
  - **Architecture researcher** - how to structure the code
  - **Pitfalls researcher** - common mistakes to avoid
- You can enable/disable these (recommended to enable for the full experience)

**The Output**
- Creates a `.planning/` folder with:
  - `PROJECT.md` - your vision document
  - `REQUIREMENTS.md` - features organized by priority
  - `ROADMAP.md` - phases with success criteria
  - `STATE.md` - tracks where you are (enables session persistence)

**Time Warning:** The whole `/gsd:new-project` process takes **10-15 minutes** depending on options chosen. That's normal - GSD is doing real research.

STOP: Ready to see all this in action? Make sense what's about to happen?

USER: Yes / Ready

---

You're all set.

GSD is installed. You understand the workflow. You know what to expect time-wise.

In the next lesson, you'll run `/gsd:new-project` and watch GSD interview you, research best practices, and create a complete project plan.

STOP: Ready? Type `/start-3-2` to continue.

USER: Ready

---

## Important Notes for Claude

- If `npx get-shit-done-cc` fails, have them try `npm install -g get-shit-done-cc` instead
- If `/gsd:help` doesn't work after resume, they may need to fully quit Claude Code and restart
- The project will be built in THIS folder (gsd-module-test) - no need to create a separate folder
- Emphasize the time expectations - students should expect waiting

## Success Criteria

- [ ] Student understands context rot and why it happens
- [ ] Student understands fresh subagent contexts as the solution
- [ ] Student completed Module 2 prerequisite check
- [ ] Student understands the module sequence (new-project → plan → execute → verify)
- [ ] Student knows time expectations (~45-60 mins, 30 of which is waiting)
- [ ] GSD is installed and `/gsd:help` works
- [ ] Student has seen PROJECT_BRIEF.md
- [ ] Student knows what /gsd:new-project will do (interview, research, create planning files)
