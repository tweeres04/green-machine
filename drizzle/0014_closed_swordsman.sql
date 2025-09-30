/*
 SQLite does not support "Drop not null from column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
 https://www.sqlite.org/lang_altertable.html
 https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3
 
 Due to that we don't generate migration automatically and it has to be done manually
 */
-- Remove NOT NULL constraint from opponent field in games table
-- SQLite requires recreating the table to modify column constraints
-- Step 1: Create new table with updated schema
CREATE TABLE games_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    opponent TEXT,
    -- Removed NOT NULL constraint
    timestamp TEXT,
    location TEXT,
    cancelled_at TEXT
);

--> statement-breakpoint
-- Step 2: Copy data from old table to new table
INSERT INTO
    games_new (
        id,
        team_id,
        opponent,
        timestamp,
        location,
        cancelled_at
    )
SELECT
    id,
    team_id,
    opponent,
    timestamp,
    location,
    cancelled_at
FROM
    games;

--> statement-breakpoint
-- Step 3: Drop old table
DROP TABLE games;

--> statement-breakpoint
-- Step 4: Rename new table to original name
ALTER TABLE
    games_new RENAME TO games;

--> statement-breakpoint
-- Step 5: Recreate indexes
CREATE INDEX games_team_id_idx ON games(team_id);