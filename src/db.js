import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || 'data/workout.db';

// Ensure the database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    week_number INTEGER,
    start_date TEXT,
    title TEXT,
    biometrics TEXT, -- JSON string
    days_data TEXT,  -- JSON string
    raw_markdown TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(telegram_id)
  );
`);

/**
 * Saves or updates user information.
 */
export function saveUser(telegramId, username, firstName) {
  const stmt = db.prepare(`
    INSERT INTO users (telegram_id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name
  `);
  stmt.run(Number(telegramId), username || null, firstName || null);
}

/**
 * Saves a weekly workout plan. Overwrites if same user and week number already exist.
 */
export function saveWorkout(userId, weekNumber, startDate, title, biometrics, daysData, rawMarkdown) {
  const existing = db.prepare(`
    SELECT id FROM workouts WHERE user_id = ? AND week_number = ?
  `).get(Number(userId), Number(weekNumber));

  if (existing) {
    const stmt = db.prepare(`
      UPDATE workouts
      SET start_date = ?, title = ?, biometrics = ?, days_data = ?, raw_markdown = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(startDate, title, JSON.stringify(biometrics), JSON.stringify(daysData), rawMarkdown, existing.id);
    return existing.id;
  } else {
    const stmt = db.prepare(`
      INSERT INTO workouts (user_id, week_number, start_date, title, biometrics, days_data, raw_markdown)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      Number(userId),
      Number(weekNumber),
      startDate,
      title,
      JSON.stringify(biometrics),
      JSON.stringify(daysData),
      rawMarkdown
    );
    return res.lastInsertRowid;
  }
}

/**
 * Retrieves all weekly workouts for a specific user.
 */
export function getWorkoutsForUser(userId) {
  const stmt = db.prepare(`
    SELECT id, week_number, start_date, title 
    FROM workouts 
    WHERE user_id = ? 
    ORDER BY start_date DESC
  `);
  return stmt.all(Number(userId));
}

/**
 * Retrieves a specific workout for a user by week number.
 */
export function getWorkout(userId, weekNumber) {
  const row = db.prepare(`
    SELECT * FROM workouts WHERE user_id = ? AND week_number = ?
  `).get(Number(userId), Number(weekNumber));

  if (!row) return null;

  return {
    ...row,
    biometrics: JSON.parse(row.biometrics),
    days_data: JSON.parse(row.days_data)
  };
}

/**
 * Updates biometrics for a specific workout.
 */
export function updateWorkoutBiometrics(userId, weekNumber, biometrics, rawMarkdown) {
  const stmt = db.prepare(`
    UPDATE workouts
    SET biometrics = ?, raw_markdown = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND week_number = ?
  `);
  stmt.run(JSON.stringify(biometrics), rawMarkdown, Number(userId), Number(weekNumber));
}

/**
 * Updates exercise/day data for a specific workout.
 */
export function updateWorkoutDays(userId, weekNumber, daysData, rawMarkdown) {
  const stmt = db.prepare(`
    UPDATE workouts
    SET days_data = ?, raw_markdown = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND week_number = ?
  `);
  stmt.run(JSON.stringify(daysData), rawMarkdown, Number(userId), Number(weekNumber));
}
