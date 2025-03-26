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
  node trello-cli.js [command] [args]

Available Commands:
  move "<board_name>" "<from_list_name>" "<task_name>" "<to_list_name>"  Move a task
  add "<board_name>" "<list_name>" "<task_name>"                         Add a task
  delete "<board_name>" "<list_name>" "<task_name>"                      Delete a task
  --help, -h                                                             Show help

Examples:
  node trello-cli.js move "Roadmap" "In Progress" "Fix bug #42" "Done"
  node trello-cli.js add "Roadmap" "To Do" "Review PR"
  node trello-cli.js delete "Roadmap" "In Progress" "Fix bug #42"
  node trello-cli.js
  `);
}

// Fetch boards
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

// Fetch lists from a board by name
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

// Fetch a task by name from a list
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
      choices: ["Move a task", "Add a task", "Delete a task"],
    },
  ]);

  if (action === "Move a task") {
    const fromList = await getListByName(
      boards.id,
      await inquirer
        .prompt([
          {
            type: "list",
            name: "listName",
            message: "Select list to move from:",
            choices: lists.map((l) => l.name),
          },
        ])
        .then((a) => a.listName)
    );

    const cards = await getCards(fromList.id);
    const card = await getTaskByName(
      fromList.id,
      await inquirer
        .prompt([
          {
            type: "list",
            name: "cardName",
            message: "Select a task to move:",
            choices: cards.map((c) => c.name),
          },
        ])
        .then((a) => a.cardName)
    );

    const toList = await getListByName(
      boards.id,
      await inquirer
        .prompt([
          {
            type: "list",
            name: "listName",
            message: "Select destination list:",
            choices: lists.map((l) => l.name),
          },
        ])
        .then((a) => a.listName)
    );

    await moveTask(boards.name, fromList.name, card.name, toList.name);
  }
}

main().catch((err) => console.error("❌ Error:", err.message));
