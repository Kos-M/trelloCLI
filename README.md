# trelloCLI
A command-line interface for interacting with Trello.

## Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Create a `.env` file based on `env.sample` and fill in your Trello API key and token.

## Usage
Run `node index.js --help` to see available commands. Quote every argument; board, list, task
and label names are matched case-insensitively and must otherwise be exact.

| Command | What it does |
|---|---|
| `get "<board>" "<list>"` | List the tasks in a list, with descriptions |
| `add "<board>" "<list>" "<task>"` | Create a task |
| `add-list "<board>" "<list>"` | Create a list at the right end of the board |
| `move "<board>" "<from list>" "<task>" "<to list>"` | Move a task |
| `delete "<board>" "<list>" "<task>"` | Delete a task (permanent) |
| `append "<board>" "<list>" "<task>" "<text>"` | Append a line to the description |
| `comment "<board>" "<list>" "<task>" "<text>"` | Add a comment |
| `boards` | List your open boards |
| `lists "<board>"` | List a board's open lists, in order |
| `labels "<board>"` | List a board's labels (unnamed ones show as `(color)`) |
| `label "<board>" "<list>" "<task>" "<label>"` | Attach an existing board label (never creates one) |
| `unlabel "<board>" "<list>" "<task>" "<label>"` | Remove a label |
| `rename "<board>" "<list>" "<task>" "<new name>"` | Rename a task |
| `archive "<board>" "<list>" "<task>"` | Archive a task (restorable, unlike `delete`) |
| `due "<board>" "<list>" "<task>" "<YYYY-MM-DD\|none>"` | Set or clear the due date |