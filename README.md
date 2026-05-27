# GSD Module - Test Version

Test folder for the "Build with GSD" module (Module 3).

## How to Test

1. Open this folder in Claude Code:
   ```
   cd /path/to/gsd-module-test
   claude
   ```

2. Start the first lesson:
   ```
   /start-3-1
   ```

3. Follow the lessons in order:
   - `/start-3-1` - What is GSD (install, context rot, project intro)
   - `/start-3-2` - Start a Project (/gsd:new-project)
   - `/start-3-3` - Plan the Build (/gsd:plan-phase)
   - `/start-3-4` - Execute (/gsd:execute-phase)
   - `/start-3-5` - Verify & Beyond (/gsd:verify-work, quick mode)

## Files

```
gsd-module-test/
├── .claude/
│   ├── SCRIPT_INSTRUCTIONS.md    # How Claude should teach
│   └── commands/
│       ├── start-3-1.md          # Lesson launchers
│       ├── start-3-2.md
│       ├── start-3-3.md
│       ├── start-3-4.md
│       └── start-3-5.md
├── lesson-modules/
│   ├── 3.1-what-is-gsd/CLAUDE.md
│   ├── 3.2-start-project/CLAUDE.md
│   ├── 3.3-plan-build/CLAUDE.md
│   ├── 3.4-execute/CLAUDE.md
│   └── 3.5-verify-beyond/CLAUDE.md
├── course-structure.json
├── PROJECT_BRIEF.md              # The Expense Splitter spec
└── README.md
```

## Notes for Testing

- Students need to create an `expense-splitter/` folder during 3.1
- GSD must be installed globally (`npx get-shit-done-cc`)
- The GSD commands take over the conversation - bookend structure
- Expect 60-80 minutes total for all 5 lessons
- Token usage will be high due to GSD's agent spawning

## What to Watch For

- Does the bookend flow work? (intro → GSD command → "done" → debrief)
- Is the pacing right?
- Do the explanations land before students run GSD commands?
- Does verification actually catch issues?
