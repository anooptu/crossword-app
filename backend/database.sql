-- PostgreSQL schema for the crossword game

CREATE TABLE "crossword_words" (
    "id" SERIAL PRIMARY KEY,
    "word" VARCHAR(100) NOT NULL,
    "clue" TEXT NOT NULL,
    "row_idx" INT NOT NULL,
    "col_idx" INT NOT NULL,
    "direction" VARCHAR(1) NOT NULL CHECK ("direction" IN ('A', 'D')),
    "clue_number" INT NOT NULL
);

CREATE TABLE "player_games" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INT NOT NULL UNIQUE,
    "score" INT NOT NULL,
    "time_taken" INT NOT NULL,
    "words_solved" JSONB,
    "play_date" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "users" (
    "id" SERIAL PRIMARY KEY,
    "username" VARCHAR(50) NOT NULL UNIQUE,
    "password_hash" VARCHAR(255) NOT NULL,
    "score" INT DEFAULT 0,
    "total_score" INT DEFAULT 0,
    "highscore" INT DEFAULT 0,
    "games_played" INT DEFAULT 0,
    "wins" INT DEFAULT 0,
    "losses" INT DEFAULT 0,
    "has_started_game" BOOLEAN DEFAULT false,
    "game_started_at" TIMESTAMP WITH TIME ZONE
);

ALTER TABLE "player_games"
    ADD CONSTRAINT "player_games_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

CREATE VIEW "leaderboard" AS
SELECT
    "id",
    "username",
    "total_score",
    "highscore",
    "games_played",
    "wins",
    "losses"
FROM "users"
ORDER BY "highscore" DESC, "total_score" DESC;
