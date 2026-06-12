# Command History (ArrowUp / ArrowDown) — Design

Date: 2026-06-12
Status: approved

## Goal

When the command input is focused, pressing ArrowUp recalls previously entered
commands; ArrowDown moves back toward the most recent / empty line. Standard
shell behavior.

## Scope

- In-memory only: history is lost on page reload (explicit user choice — no
  IndexedDB persistence).
- No draft preservation: text typed before pressing ArrowUp is replaced.

## Design

All changes in `src/main.ts`, class `Terminal`:

- New private fields:
  - `history: string[]` — commands in submission order.
  - `historyIndex: number` — current navigation position; `history.length`
    means "past the end" (fresh input line).
- Submit handler (existing `form` listener): after reading the trimmed
  command, push it to `history` unless it equals the last entry, then set
  `historyIndex = history.length`.
- Existing `keydown` listener (currently handles Tab):
  - `ArrowUp`: `preventDefault()`; if `historyIndex > 0`, decrement and set
    input value to `history[historyIndex]`, cursor at end.
  - `ArrowDown`: `preventDefault()`; if `historyIndex < history.length`,
    increment; if now past the end, clear input, else show that entry.

## Rejected alternative

Separate `HistoryManager` with interface like the other managers — overkill
for ~25 lines; inline in `Terminal` matches the existing Tab-completion code.

## Verification

No test framework in repo. Manual check with `npm run dev`:

1. Enter `help`, `ls`, `pwd`.
2. ArrowUp three times → shows `pwd`, `ls`, `help`; further presses stay on `help`.
3. ArrowDown back down → `ls`, `pwd`, then empty input.
4. Submit recalled command works normally; duplicate consecutive commands
   stored once.
