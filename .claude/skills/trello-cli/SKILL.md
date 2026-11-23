---
name: trello-cli
description: Read and change Trello cards from the terminal with this repo's trelloCLI (list boards, lists, cards and labels; add, move, rename, archive, delete; label/unlabel; set due dates; append to a description; comment). Use when the user asks to check, create, move, label, update or comment on a Trello task/card, or to report progress to a Trello board.
---

# trelloCLI

Run from the repo root as `node index.js <command> ...` (or `trelloCLI ...` if it was installed with `npm link`).

## Before you start

- `npm install` must have been run (`node_modules/` exists).
- `.env` must hold `TRELLO_API_KEY` and `TRELLO_TOKEN` (see `env.sample`). If they are missing the CLI exits with "Missing Trello API Key or Token". Ask the user for them; never invent or print them.

## Commands

Every name is matched case-insensitively and must be exact otherwise (no partial matches). Always quote each argument.

| Goal | Command |
|---|---|
| List cards (with descriptions) | `get "<board>" "<list>"` |
| Create a card | `add "<board>" "<list>" "<card>"` |
| Create a list (right end of the board) | `add-list "<board>" "<list>"` |
| Move a card | `move "<board>" "<from list>" "<card>" "<to list>"` |
| Delete a card | `delete "<board>" "<list>" "<card>"` |
| Append a line to the description | `append "<board>" "<list>" "<card>" "<text>"` |
| Add a comment | `comment "<board>" "<list>" "<card>" "<text>"` |
| List your open boards | `boards` |
| List a board's open lists (in order) | `lists "<board>"` |
| List a board's labels (name + color) | `labels "<board>"` |
| Attach an existing label | `label "<board>" "<list>" "<card>" "<label>"` |
| Remove a label | `unlabel "<board>" "<list>" "<card>" "<label>"` |
| Rename a card | `rename "<board>" "<list>" "<card>" "<new name>"` |
| Archive a card (reversible) | `archive "<board>" "<list>" "<card>"` |
| Set or clear a due date | `due "<board>" "<list>" "<card>" "<YYYY-MM-DD\|none>"` |

`append` adds `📝 <text>` as a new paragraph; it never replaces the existing description.

## How to use it well

1. **Look before you write.** Use `boards` and `lists` to find the exact board and list names, then `get` on the list to confirm the card name. Copy them verbatim from the output.
2. **Duplicates:** if two cards in a list share a name, the CLI acts on the first one. If `get` shows a duplicate, tell the user before running any command that changes a card.
3. **`delete` is permanent** and has no confirmation prompt. Only run it when the user asked for that specific card to be deleted. Prefer `archive` (restorable from Trello's archive) unless the user said delete.
4. **Prefer `comment` for progress notes** (timestamped, attributed). Use `append` only when the user wants the note in the description itself.
5. **`label` only attaches labels that already exist on the board; it never creates one.** Run `labels "<board>"` first and copy the label name exactly. An unnamed label is shown as `(color)` and is matched by its color. Labelling a card that already has the label is a no-op (ℹ️).
6. Write text arguments as one quoted string. Do not put a newline in a shell argument; use separate commands instead.
7. After a write, run `get` again if the user needs confirmation of the new state.

## Reading results

- Success lines start with ✅ / 💬 / 📋 / ℹ️ and the exit code is 0.
- Failure lines start with ❌ and the exit code is 1:
  - `Board/List/Task "X" not found` → wrong name; run `get` (or ask the user for the board name) and retry with the exact name.
  - `Error: invalid key` / `invalid token` / `unauthorized` → credentials are wrong or the token expired (tokens from `env.sample`'s link last 1 day). Ask the user to generate a new token; do not retry.
  - `Label "X" not found` → no such label on the board; run `labels` and use an existing name. Do not create labels.
  - `Invalid due date` → use `YYYY-MM-DD` or `none`.
  - `Invalid arguments` → wrong argument count for the command; check the table above.
