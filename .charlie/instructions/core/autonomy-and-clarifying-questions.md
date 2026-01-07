# Autonomy and clarifying questions

Avoid slowing down work with unnecessary clarification loops.

## Scope

Applies to all tasks in this repo.

## Rules

- [R1] Before asking a clarifying question, ask: **“Will the answer create an actual choice about the intended functionality described by the user’s original prompt?”**
  - If **yes**, ask.
  - If **no** (it’s just best practice / code style / scalability), proceed with your best guess.
- [R2] When making a “best practice” choice without user input, choose the smallest approach that is:
  - correct for the current prompt
  - easy to extend later
  - not over-engineered
  - consistent with existing repo conventions (if present); otherwise choose the simplest common option
- [R3] When you proceed without asking, state your assumption(s) in the PR/issue comment (not in source).
- [R4] If multiple clarifications are possible, ask only the 1–2 that most affect intended functionality; otherwise proceed.

## Examples

### Good

- “Do you want this behavior to apply to *all* pages or only the `/channel/*` routes?” (functional choice)

### Bad

- “Should we use library X or Y for this?” when either is fine and the prompt doesn’t care (make a best guess)
