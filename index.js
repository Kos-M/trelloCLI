#!/usr/bin/env node

import axios from "axios";
import inquirer from "inquirer";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.TRELLO_API_KEY;
const TOKEN = process.env.TRELLO_TOKEN;
const BASE_URL = "https://api.trello.com/1";

if (!API_KEY || !TOKEN) {
  console.error("Missing Trello API Key or Token. Set them in .env file.");
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
  --help, -h                                                             Show help

Examples:
  trelloCLI move "Roadmap" "In Progress" "Fix bug #42" "Done"
  trelloCLI add "Roadmap" "To Do" "Review PR"
  trelloCLI delete "Roadmap" "In Progress" "Fix bug #42"
  trelloCLI get "Roadmap" "In Progress"
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

// Add a task
async function addTask(boardName, listName, taskName) {
  const board = await getBoardByName(boardName);
  const list = await getListByName(board.id, listName);

  await axios.post(`${BASE_URL}/cards`, null, {
    params: { key: API_KEY, token: TOKEN, idList: list.id, name: taskName },
  });

  console.log(`✅ Task "${taskName}" added to "${listName}"`);
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

// NEW: Get all tasks from a list
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

  console.log(`📋 Tasks in "${listName}":`);
  response.data.forEach((task) => {
    console.log(`- ${task.name}`);
  });
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

    console.error("Invalid arguments. Run --help for usage instructions.");
    process.exit(1);
  }

  // Interactive Mode
  const boards = await getBoardByName(
    await inquirer
      .prompt([
        { type: "input", name: "boardName", message: "Enter board name:" },
      ])
      .then((a) => a.boardName)
  );

  const lists = await axios
    .get(`${BASE_URL}/boards/${boards.id}/lists`, {
      params: { key: API_KEY, token: TOKEN },
    })
    .then((res) => res.data);

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Choose an action:",
      choices: [
        "Move a task",
        "Add a task",
        "Delete a task",
        "Get tasks from a list",
      ],
    },
  ]);

  if (action === "Get tasks from a list") {
    const listName = await inquirer
      .prompt([
        {
          type: "list",
          name: "listName",
          message: "Select list:",
          choices: lists.map((l) => l.name),
        },
      ])
      .then((a) => a.listName);

    await getTasksFromList(boards.name, listName);
  }
}

main().catch((err) => console.error("❌ Error:", err.message));
