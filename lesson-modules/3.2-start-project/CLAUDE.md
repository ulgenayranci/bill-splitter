# 3.2 Start a Project

In this lesson, you'll run `/gsd:new-project` for the first time.

Here's what GSD is going to do:

1. **Interview you** about what you want to build (~3-5 mins of your input)
2. **Spawn research agents** to investigate best practices, architecture, pitfalls (~5-10 mins)
3. **Create requirements** organized into v1/v2/out-of-scope
4. **Generate a roadmap** with phases and success criteria
5. **Save everything** to a `.planning/` folder

All from one command. You just answer questions when prompted.

STOP: Ready?

USER: Yes

---

## Before You Run It

A few important things:

**This will take 10-15 minutes.** Most of that is GSD researching and planning while you wait. That's normal - it's doing real work.

**You'll be asked questions first.** Use your `PROJECT_BRIEF.md` as reference when describing the Expense Splitter. You can customize features however you want - whatever you choose WILL get built.

**You'll see optional agent toggles.** GSD will ask if you want:
- **Research agents** - investigate best practices (recommended ON)
- **Plan checker** - verifies plans achieve goals (recommended ON)
- **Verifier** - confirms work after execution (recommended ON)

These add quality but also add time. I recommend enabling all of them for the full experience.

**When it finishes**, you'll see "PROJECT INITIALIZED" and be back at the normal prompt.

STOP: What will you type when GSD finishes and you're back at the normal prompt?

USER: Done

Exactly - you'll type "done" so we can continue the lesson together.

---

## Run It

Type `/gsd:new-project` and hit enter.

GSD will take over and start asking you questions. Answer using your `PROJECT_BRIEF.md` as a guide - describe the Expense Splitter features.

Remember: this takes 10-15 minutes. Grab a coffee if you want. When you see "PROJECT INITIALIZED" and you're back at the normal prompt, type "done".

STOP: Run `/gsd:new-project` now. Type "done" when you're back at the normal prompt.

USER: Done

---

## Let's See What GSD Created

Nice work! GSD just did a lot behind the scenes.

It interviewed you to understand your vision. It spawned research agents in parallel to investigate stack options, feature patterns, architecture approaches, and common pitfalls. Then it synthesized everything into a structured spec.

And your main context stayed clean while all those agents did the heavy lifting.

Let's tour what it created.

ACTION: List the contents of the .planning folder with `ls -la .planning/`

---

You should see several files. Let me walk you through each one.

ACTION: Read .planning/PROJECT.md and summarize its contents

**PROJECT.md** is your project vision and constraints - the high-level "what and why." It captures what you described in the interview.

STOP: Does it match what you described?

USER: Yes

---

ACTION: Read .planning/REQUIREMENTS.md and summarize its contents

**REQUIREMENTS.md** has your features organized into v1, v2, and out-of-scope.

Notice the REQ-IDs - things like PEOPLE-01, SPLIT-02. These trace through the whole system. Every requirement maps to exactly one phase. When GSD builds and verifies, it references these IDs.

STOP: See how it organized the features?

USER: Yes

---

ACTION: Read .planning/ROADMAP.md and summarize its contents

**ROADMAP.md** shows the phases and what each one delivers.

Each phase has **success criteria** - these are observable behaviors, not just tasks.

"User can add people to the bill" is a success criterion. "Create People component" is just a task. GSD thinks in **outcomes**.

STOP: Make sense how the roadmap is structured?

USER: Yes

---

ACTION: Read .planning/STATE.md and summarize its contents

**STATE.md** is GSD's memory. It tracks where you are, what decisions were made, any blockers.

Here's the cool part: if you close Claude and come back tomorrow, GSD reads this file and picks up exactly where you left off. No more "wait, where was I?" - the state persists across sessions.

STOP: Pretty useful, right?

USER: Yes

---

## Recap

You just went from project brief to complete spec with one command.

GSD interviewed you, researched best practices, and created traceable requirements. The `.planning/` folder is now your source of truth.

Here's what you have:
- **PROJECT.md** - Vision and constraints
- **REQUIREMENTS.md** - Features with IDs that trace through the system
- **ROADMAP.md** - Phases with success criteria (outcomes, not tasks)
- **STATE.md** - Persistent memory across sessions

Next, we'll plan Phase 1. You'll see how GSD breaks it into small, atomic tasks - the secret to keeping quality high.

STOP: Ready to plan the build? Type `/start-3-3` to continue.

USER: Ready

---

## Important Notes for Claude

- If .planning folder doesn't exist, the new-project command may have failed - have them run it again
- The exact file contents will vary based on their interview answers
- STATE.md might be minimal at this point - that's normal
- **After "done"**: Always walk through each file in .planning/ - read and summarize each one
- The file tour is critical for understanding what GSD created

## Success Criteria

- [ ] Student ran /gsd:new-project successfully
- [ ] .planning/ folder exists with PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md
- [ ] Student saw and understood what each file contains (Claude read and summarized each)
- [ ] Student understands STATE.md enables session persistence
- [ ] Student knows requirements have IDs that trace through the system
- [ ] Student understands roadmap has success criteria (outcomes, not tasks)
