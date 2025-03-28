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
  delete "<board_name>" "<list_name>" "<task_name>"                      Delete a task
  get "<board_name>" "<list_name>"                                       Get all tasks from a list
  append "<board_name>" "<list_name>" "<task_name>" "<extra_info>"       Append info to a task
  comment "<board_name>" "<list_name>" "<task_name>" "<comment_text>"    Add a comment to a task
  --help, -h                                                             Show help

Examples:
  trelloCLI move "Roadmap" "In Progress" "Fix bug #42" "Done"
  trelloCLI add "Roadmap" "To Do" "Review PR"
  trelloCLI delete "Roadmap" "In Progress" "Fix bug #42"
  trelloCLI get "Roadmap" "In Progress"
  trelloCLI append "Roadmap" "In Progress" "Fix bug #42" "New debug logs added."
  trelloCLI comment "Roadmap" "In Progress" "Fix bug #42" "This needs further testing."
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

// Append extra info to a task's description
async function appendToTask(boardName, listName, taskName, extraInfo) {
  const board = await getBoardByName(boardName);
  const list = await getListByName(board.id, listName);
  const task = await getTaskByName(list.id, taskName);

  const updatedDescription = task.desc
    ? `${task.desc.trim()}\n\n📝 ${extraInfo}`
    : `📝 ${extraInfo}`;

  await axios.put(`${BASE_URL}/cards/${task.id}`, null, {
    params: { key: API_KEY, token: TOKEN, desc: updatedDescription },
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

// Add a comment to a task
async function addComment(boardName, listName, taskName, commentText) {
  const board = await getBoardByName(boardName);
  const list = await getListByName(board.id, listName);
  const task = await getTaskByName(list.id, taskName);

  await axios.post(`${BASE_URL}/cards/${task.id}/actions/comments`, null, {
    params: { key: API_KEY, token: TOKEN, text: commentText },
  });

  console.log(`💬 Comment added to "${taskName}": "${commentText}"`);
}

// CLI Entry Function
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    if (args.includes("--help") || args.includes("-h")) {
      showHelp();
      return;
    }

    const [action, boardName, ...params] = args;

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

main().catch((err) => console.error("❌ Error:", err.message));
