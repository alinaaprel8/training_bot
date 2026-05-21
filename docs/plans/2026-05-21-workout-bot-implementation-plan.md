# Workout Telegram Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Node.js-based Telegram bot using grammY and SQLite to upload, parse, view, edit, and download weekly workout Markdown files.

**Architecture:** A lightweight Node.js bot leveraging `grammY` for menus, `better-sqlite3` for fast relational and JSON storage, and custom regular expressions to parse and regenerate weekly workout Markdown files seamlessly.

---

### Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Write package.json and other files**
We will create a Node.js project using ESM (type: module) for modern syntax.

**Step 2: Create files**
We will write package.json with dependencies `grammy`, `better-sqlite3`, and `dotenv`.

**Step 3: Run npm install**
Verify the packages install correctly.

---

### Task 2: Database Layer (`src/db.js`)

**Files:**
- Create: `src/db.js`
- Test: `src/test-db.js`

**Step 1: Write DB initialization and helpers**
Create users table and workouts table.
Provide database functions: `saveUser`, `saveWorkout`, `getWorkoutsForUser`, `getWorkout`, `updateWorkoutBiometrics`, `updateWorkoutDays`.

**Step 2: Run test-db.js to verify SQLite**
Verify connection, table creation, inserting a mock user and workout, retrieving, and updating.

---

### Task 3: Markdown Parser & Generator (`src/parser.js`)

**Files:**
- Create: `src/parser.js`
- Test: `src/test-parser.js`

**Step 1: Write parser logic**
Write robust regex logic to parse yaml frontmatter, biometrics, day blocks, and individual exercises (with weight/sets/reps/RPE and comments on the next line).
Write generation logic to reconstruct markdown text from parsed JSON.

**Step 2: Run parser tests**
Run a test that takes the user's provided markdown, parses it, checks parsed properties, and makes sure the regenerated markdown matches the original.

---

### Task 4: Bot Flow & Dynamic Menu Navigation (`src/bot.js`, `src/menus.js`)

**Files:**
- Create: `src/menus.js`
- Create: `src/bot.js`

**Step 1: Implement grammY menus**
Create the navigation tree:
- Main Menu (List of weeks)
- Week Menu (Days, biometrics, download, raw edit)
- Day Menu (List of exercises)
- Exercise Detail Menu (edit weight, RPE, comment)

**Step 2: Connect files & inputs**
Implement Telegram file listener: download `.md` files, parse, and store them.
Implement conversational state handlers for text inputs.
Verify everything connects beautifully.
