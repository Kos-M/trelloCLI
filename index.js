#!/usr/bin/env node

import axios from "axios";
import inquirer from "inquirer";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.TRELLO_API_KEY;
const TOKEN = process.env.TRELLO_TOKEN;
const BASE_URL = "https://api.trello.com/1";

if (!API_KEY || !TOKEN) {
  console.error("❌ Missing Trello API Key or Token. Set them in .env file.");
  process.exit(1);
}

// Display help message
function showHelp() {
  console.log(`
Usage:
  trelloCLI [command] [args]

Available Commands:
  move "<board_name>" "<from_list_name>" "<task_name>" "<to_list_name>"  Move a task
  add "<board_name>" "<list_name>" "<task_name>"                         Add a task
  add-list "<board_name>" "<list_name>"                                  Add a list (at the right end)
  delete "<board_name>" "<list_name>" "<task_name>"                      Delete a task
  get "<board_name>" "<list_name>"                                       Get all tasks from a list
  append "<board_name>" "<list_name>" "<task_name>" "<extra_info>"       Append info to a task
  comment "<board_name>" "<list_name>" "<task_name>" "<comment_text>"    Add a comment to a task
  boards                                                                 List your open boards
  lists "<board_name>"                                                   List a board's open lists in order
  labels "<board_name>"                                                  List a board's labels (name + color)
  label "<board_name>" "<list_name>" "<task_name>" "<label_name>"        Attach an existing board label
  unlabel "<board_name>" "<list_name>" "<task_name>" "<label_name>"      Remove a label from a task
  rename "<board_name>" "<list_name>" "<task_name>" "<new_name>"         Rename a task
  archive "<board_name>" "<list_name>" "<task_name>"                     Archive a task (reversible)
  due "<board_name>" "<list_name>" "<task_name>" "<YYYY-MM-DD|none>"     Set or clear a task's due date
  --help, -h                                                             Show help

Examples:
  trelloCLI move "Roadmap" "In Progress" "Fix bug #42" "Done"
  trelloCLI add "Roadmap" "To Do" "Review PR"
  trelloCLI add-list "Roadmap" "Backlog"
  trelloCLI delete "Roadmap" "In Progress" "Fix bug #42"
  trelloCLI get "Roadmap" "In Progress"
  trelloCLI append "Roadmap" "In Progress" "Fix bug #42" "New debug logs added."
  trelloCLI comment "Roadmap" "In Progress" "Fix bug #42" "This needs further testing."
  trelloCLI labels "Roadmap"
  trelloCLI label "Roadmap" "In Progress" "Fix bug #42" "Bug"
  trelloCLI rename "Roadmap" "In Progress" "Fix bug #42" "Fix bug #42 (login)"
  trelloCLI due "Roadmap" "In Progress" "Fix bug #42" "2026-12-01"
  `);
}

// Fetch board by name
async function getBoardByName(name) {
  const response = await axios.get(`${BASE_URL}/members/me/boards`, {
    params: { key: API_KEY, token: TOKEN },
  });
  const board = response.data.find(
    (b) => b.name.toLowerCase() === name.toLowerCase()
  );
  if (!board) {
    console.error(`❌ Board "${name}" not found.`);
    process.exit(1);
  }
  return board;
}

// Fetch list by name
async function getListByName(boardId, name) {
  const response = await axios.get(`${BASE_URL}/boards/${boardId}/lists`, {
    params: { key: API_KEY, token: TOKEN },
  });
  const list = response.data.find(
    (l) => l.name.toLowerCase() === name.toLowerCase()
  );
  if (!list) {
    console.error(`❌ List "${name}" not found.`);
    process.exit(1);
  }
  return list;
}

// Fetch task by name
async function getTaskByName(listId, taskName) {
  const response = await axios.get(`${BASE_URL}/lists/${listId}/cards`, {
    params: { key: API_KEY, token: TOKEN },
  });
  const task = response.data.find(
    (c) => c.name.toLowerCase() === taskName.toLowerCase()
  );
  if (!task) {
    console.error(`❌ Task "${taskName}" not found.`);
    process.exit(1);
  }
  return task;
}

// Fetch a board label by name; an unnamed label can be matched by its color
async function getLabelByName(boardId, labelName) {
  const response = await axios.get(`${BASE_URL}/boards/${boardId}/labels`, {
    params: { key: API_KEY, token: TOKEN, limit: 1000 },
  });
  const wanted = labelName.toLowerCase();
  const label =
    response.data.find((l) => l.name.toLowerCase() === wanted) ||
    response.data.find((l) => !l.name && l.color?.toLowerCase() === wanted);
  if (!label) {
    console.error(`❌ Label "${labelName}" not found. Run labels "<board_name>" to see them.`);
    process.exit(1);
  }
  return label;
}

// Resolve board -> list -> task in one step
async function findTask(boardName, listName, taskName) {
  const board = await getBoardByName(boardName);
  const list = await getListByName(board.id, listName);
  const task = await getTaskByName(list.id, taskName);
  return { board, list, task };
}

// Update fields on a task (sent in the body, not the URL)
async function updateTask(taskId, fields) {
  await axios.put(`${BASE_URL}/cards/${taskId}`, fields, {
    params: { key: API_KEY, token: TOKEN },
  });
}

const labelTitle = (label) => label.name || `(${label.color})`;

// List the open boards the token can see
async function listBoards() {
  const response = await axios.get(`${BASE_URL}/members/me/boards`, {
    params: { key: API_KEY, token: TOKEN, filter: "open", fields: "name" },
  });
  console.log("📋 Boards:\n");
  response.data.forEach((b) => console.log(b.name));
}

// List a board's open lists in board order
async function listLists(boardName) {
  const board = await getBoardByName(boardName);
  const response = await axios.get(`${BASE_URL}/boards/${board.id}/lists`, {
    params: { key: API_KEY, token: TOKEN, filter: "open", fields: "name,pos" },
  });
  console.log(`📋 Lists in "${board.name}":\n`);
  response.data
    .sort((a, b) => a.pos - b.pos)
    .forEach((l) => console.log(l.name));
}

// List a board's labels with their colors
async function listLabels(boardName) {
  const board = await getBoardByName(boardName);
  const response = await axios.get(`${BASE_URL}/boards/${board.id}/labels`, {
    params: { key: API_KEY, token: TOKEN, limit: 1000 },
  });
  if (response.data.length === 0) {
    console.log(`ℹ️ No labels on "${board.name}".`);
    return;
  }
  console.log(`📋 Labels on "${board.name}":\n`);
  response.data.forEach((l) => console.log(`${labelTitle(l)} [${l.color || "no color"}]`));
}

// Attach an existing board label to a task
async function labelTask(boardName, listName, taskName, labelName) {
  const { board, task } = await findTask(boardName, listName, taskName);
  const label = await getLabelByName(board.id, labelName);

  if (task.idLabels.includes(label.id)) {
    console.log(`ℹ️ "${taskName}" already has label "${labelTitle(label)}"`);
    return;
  }

  await axios.post(`${BASE_URL}/cards/${task.id}/idLabels`, { value: label.id }, {
    params: { key: API_KEY, token: TOKEN },
  });

  console.log(`✅ Label "${labelTitle(label)}" added to "${taskName}"`);
}

// Remove a label from a task
async function unlabelTask(boardName, listName, taskName, labelName) {
  const { board, task } = await findTask(boardName, listName, taskName);
  const label = await getLabelByName(board.id, labelName);

  if (!task.idLabels.includes(label.id)) {
    console.log(`ℹ️ "${taskName}" does not have label "${labelTitle(label)}"`);
    return;
  }

  await axios.delete(`${BASE_URL}/cards/${task.id}/idLabels/${label.id}`, {
    params: { key: API_KEY, token: TOKEN },
  });

  console.log(`✅ Label "${labelTitle(label)}" removed from "${taskName}"`);
}

// Rename a task
async function renameTask(boardName, listName, taskName, newName) {
  const { task } = await findTask(boardName, listName, taskName);
  await updateTask(task.id, { name: newName });
  console.log(`✅ Task "${taskName}" renamed to "${newName}"`);
}

// Archive a task (reversible from Trello's archive, unlike delete)
async function archiveTask(boardName, listName, taskName) {
  const { task } = await findTask(boardName, listName, taskName);
  await updateTask(task.id, { closed: true });
  console.log(`✅ Task "${taskName}" archived from "${listName}"`);
}

// Set a task's due date (YYYY-MM-DD) or clear it ("none")
async function setDue(boardName, listName, taskName, dueArg) {
  const clear = dueArg.toLowerCase() === "none";
  // Round-trip check rejects impossible dates like 2026-02-31, which Date.parse rolls over
  const parsed = new Date(`${dueArg}T00:00:00Z`);
  const valid = !isNaN(parsed) && parsed.toISOString().slice(0, 10) === dueArg;
  if (!clear && !valid) {
    console.error(`❌ Invalid due date "${dueArg}". Use YYYY-MM-DD or none.`);
    process.exit(1);
  }

  const { task } = await findTask(boardName, listName, taskName);
  await updateTask(task.id, { due: clear ? null : dueArg });

  console.log(clear
    ? `✅ Due date cleared on "${taskName}"`
    : `✅ Due date of "${taskName}" set to ${dueArg}`);
}

// Append extra info to a task's description
async function appendToTask(boardName, listName, taskName, extraInfo) {
  const board = await getBoardByName(boardName);
  const list = await getListByName(board.id, listName);
  const task = await getTaskByName(list.id, taskName);

  const updatedDescription = task.desc
    ? `${task.desc.trim()}\n\n📝 ${extraInfo}`
    : `📝 ${extraInfo}`;

  // Send desc in the body: it grows with every append and would overflow the URL
  await axios.put(`${BASE_URL}/cards/${task.id}`, { desc: updatedDescription }, {
    params: { key: API_KEY, token: TOKEN },
  });

  console.log(`✅ Info appended to "${taskName}"`);
}

// Get all tasks from a list with descriptions
async function getTasksFromList(boardName, listName) {
  const board = await getBoardByName(boardName);
  const list = await getListByName(board.id, listName);

  const response = await axios.get(`${BASE_URL}/lists/${list.id}/cards`, {
    params: { key: API_KEY, token: TOKEN },
  });

  if (response.data.length === 0) {
    console.log(`ℹ️ No tasks found in "${listName}".`);
    return;
  }

  console.log(`📋 Tasks in "${listName}":\n`);

  response.data.forEach((task) => {
    console.log(`${task.name}`);
    if (task.desc) console.log(`- ${task.desc.trim()}\n`);
  });
}

// Add a task
async function addTask(boardName, listName, taskName) {
  const board = await getBoardByName(boardName);
  const list = await getListByName(board.id, listName);

  await axios.post(`${BASE_URL}/cards`, null, {
    params: { key: API_KEY, token: TOKEN, idList: list.id, name: taskName },
  });

  console.log(`✅ Task "${taskName}" added to "${listName}"`);
}

// Add a list to the right end of a board
async function addList(boardName, listName) {
  const board = await getBoardByName(boardName);

  await axios.post(`${BASE_URL}/lists`, null, {
    params: { key: API_KEY, token: TOKEN, idBoard: board.id, name: listName, pos: "bottom" },
  });

  console.log(`✅ List "${listName}" added to "${boardName}"`);
}

// Add a comment to a task
async function addComment(boardName, listName, taskName, commentText) {
  const board = await getBoardByName(boardName);
  const list = await getListByName(board.id, listName);
  const task = await getTaskByName(list.id, taskName);

  await axios.post(`${BASE_URL}/cards/${task.id}/actions/comments`, { text: commentText }, {
    params: { key: API_KEY, token: TOKEN },
  });

  console.log(`💬 Comment added to "${taskName}": "${commentText}"`);
}

// Move a task
async function moveTask(boardName, fromListName, taskName, toListName) {
  const board = await getBoardByName(boardName);
  const fromList = await getListByName(board.id, fromListName);
  const toList = await getListByName(board.id, toListName);
  const task = await getTaskByName(fromList.id, taskName);

  await axios.put(`${BASE_URL}/cards/${task.id}`, null, {
    params: { key: API_KEY, token: TOKEN, idList: toList.id },
  });

  console.log(`✅ Task "${taskName}" moved to "${toListName}"`);
}

// Delete a task
async function deleteTask(boardName, listName, taskName) {
  const board = await getBoardByName(boardName);
  const list = await getListByName(board.id, listName);
  const task = await getTaskByName(list.id, taskName);

  await axios.delete(`${BASE_URL}/cards/${task.id}`, {
    params: { key: API_KEY, token: TOKEN },
  });

  console.log(`✅ Task "${taskName}" deleted from "${listName}"`);
}

// CLI Entry Function
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    if (args[0] === "--help" || args[0] === "-h") {
      showHelp();
      return;
    }

    const [action, boardName, ...params] = args;

    if (action === "boards" && args.length === 1) {
      await listBoards();
      return;
    }

    if (action === "lists" && args.length === 2) {
      await listLists(boardName);
      return;
    }

    if (action === "labels" && args.length === 2) {
      await listLabels(boardName);
      return;
    }

    if (action === "label" && params.length === 3) {
      const [listName, taskName, labelName] = params;
      await labelTask(boardName, listName, taskName, labelName);
      return;
    }

    if (action === "unlabel" && params.length === 3) {
      const [listName, taskName, labelName] = params;
      await unlabelTask(boardName, listName, taskName, labelName);
      return;
    }

    if (action === "rename" && params.length === 3) {
      const [listName, taskName, newName] = params;
      await renameTask(boardName, listName, taskName, newName);
      return;
    }

    if (action === "archive" && params.length === 2) {
      const [listName, taskName] = params;
      await archiveTask(boardName, listName, taskName);
      return;
    }

    if (action === "due" && params.length === 3) {
      const [listName, taskName, dueArg] = params;
      await setDue(boardName, listName, taskName, dueArg);
      return;
    }

    if (action === "move" && params.length === 3) {
      const [fromListName, taskName, toListName] = params;
      await moveTask(boardName, fromListName, taskName, toListName);
      return;
    }

    if (action === "add" && params.length === 2) {
      const [listName, taskName] = params;
      await addTask(boardName, listName, taskName);
      return;
    }

    if (action === "add-list" && params.length === 1) {
      const [listName] = params;
      await addList(boardName, listName);
      return;
    }

    if (action === "delete" && params.length === 2) {
      const [listName, taskName] = params;
      await deleteTask(boardName, listName, taskName);
      return;
    }

    if (action === "get" && params.length === 1) {
      const [listName] = params;
      await getTasksFromList(boardName, listName);
      return;
    }

    if (action === "append" && params.length >= 2) {
      const [listName, taskName, ...extraInfoArr] = params;
      const extraInfo = extraInfoArr.join(" "); // Join extra info into a single string
      await appendToTask(boardName, listName, taskName, extraInfo);
      return;
    }

    if (action === "comment" && params.length >= 2) {
      const [listName, taskName, ...commentArr] = params;
      const commentText = commentArr.join(" "); // Join comment text into a single string
      await addComment(boardName, listName, taskName, commentText);
      return;
    }

    console.error("❌ Invalid arguments. Run --help for usage instructions.");
    process.exit(1);
  }
}

main().catch((err) => {
  // Trello puts the real reason in the response body, not in axios's message
  const detail = err.response?.data;
  const reason = typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : err.message;
  console.error("❌ Error:", reason);
  process.exitCode = 1;
});
