const express = require('express');
require('dotenv').config();
const path = require('path');
const { spawn } = require('child_process');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const http = require('http');
const pgSession = require('connect-pg-simple')(session);

process.on("uncaughtException", (err) => {
  console.error("[ERROR] Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[ERROR] Unhandled Rejection:", reason);
});

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 3000;
const saltRounds = 10;

const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET', 'ADMIN_PASSWORD_HASH'];
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);
if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

const isLocalDatabase = !process.env.DATABASE_URL || /@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));
const sessionMiddleware = session({
    store: new pgSession({
        pool : pool,
        tableName : 'user_sessions',
        createTableIfMissing: true
      }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
});
app.use(sessionMiddleware);

const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden. Administrator access required.' });
    }
};

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const { rows } = await pool.query(
            'INSERT INTO "users" (username, password_hash) VALUES ($1, $2) RETURNING id',
            [username, hashedPassword]
        );
        res.status(201).json({ status: 'User created successfully.', userId: rows[0].id });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Username already exists.' });
        }
        console.error('Database error during sign-up:', error);
        res.status(500).json({ error: 'Database error during sign-up.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
        const { rows } = await pool.query('SELECT * FROM "users" WHERE username = $1', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            req.session.user = { id: user.id, username: user.username, role: 'user' };
            res.json({ status: 'Login successful.' });
        } else {
            res.status(401).json({ error: 'Invalid credentials.' });
        }
    } catch (error) {
        console.error('Database error during login:', error);
        res.status(500).json({ error: 'Database error during login.' });
    }
});

app.post('/api/admin/verify', async (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password is required.' });
    }
    try {
        const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        if (match) {
            req.session.user = { id: 'admin', username: 'Admin', role: 'admin' };
            res.json({ status: 'Admin verification successful.' });
        } else {
            res.status(401).json({ error: 'Invalid admin password.' });
        }
    } catch (error) {
        console.error('Error during admin verification:', error);
        res.status(500).json({ error: 'Server error during admin verification.' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out.' });
        }
        res.clearCookie('connect.sid');
        res.json({ status: 'Logout successful.' });
    });
});

app.get('/api/session/status', async (req, res) => {
    if (!req.session.user) {
        return res.json({ loggedIn: false });
    }

    if (req.session.user.role === 'admin') {
        return res.json({ loggedIn: true, user: req.session.user, hasAttempted: false });
    }

    try {
        const { rows } = await pool.query(
            'SELECT u.has_started_game, EXISTS (SELECT 1 FROM "player_games" pg WHERE pg.user_id = u.id) AS has_submitted_game FROM "users" u WHERE u.id = $1',
            [req.session.user.id]
        );
        const attempt = rows[0] || {};
        res.json({
            loggedIn: true,
            user: req.session.user,
            hasAttempted: Boolean(attempt.has_started_game || attempt.has_submitted_game)
        });
    } catch (error) {
        console.error('DB error checking session status:', error);
        res.status(500).json({ error: 'DB error while checking session status.' });
    }
});

app.get('/api/generateCrossword', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const { rowCount } = await pool.query(
            'UPDATE "users" SET has_started_game = true, game_started_at = COALESCE(game_started_at, NOW()) WHERE id = $1 AND has_started_game = false AND NOT EXISTS (SELECT 1 FROM "player_games" WHERE user_id = $1)',
            [userId]
        );
        if (rowCount === 0) {
            return res.status(403).json({ error: 'You have already used your one allowed attempt.' });
        }
    } catch (error) {
        console.error('DB error checking game attempt:', error);
        return res.status(500).json({ error: 'DB error while checking game attempt.' });
    }

    const cProcess = spawn(path.join(__dirname, 'backend', 'main'), ['generate'], { cwd: path.join(__dirname, 'backend') });
    let output = '';
    let errorOutput = '';
    cProcess.stdout.on('data', (data) => output += data.toString());
    cProcess.stderr.on('data', (data) => errorOutput += data.toString());
    cProcess.on('close', async (code) => {
        if (code === 0) {
            try {
                const crosswordData = JSON.parse(output);
                await pool.query('DELETE FROM "crossword_words"');
                if (crosswordData.clues && crosswordData.clues.length > 0) {
                    for (const c of crosswordData.clues) {
                        await pool.query('INSERT INTO "crossword_words" (id, word, clue, row_idx, col_idx, direction, clue_number) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
                            [c.word_id, c.word, c.text, c.row, c.col, c.dir, c.number]);
                    }
                }
                res.json(crosswordData);
            } catch (e) {
                await pool.query('UPDATE "users" SET has_started_game = false, game_started_at = NULL WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM "player_games" WHERE user_id = $1)', [userId]);
                console.error('Failed to parse C backend output or save to DB:', e, 'Output:', output);
                res.status(500).json({ error: 'Failed to process crossword data.' });
            }
        } else {
            await pool.query('UPDATE "users" SET has_started_game = false, game_started_at = NULL WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM "player_games" WHERE user_id = $1)', [userId]);
            console.error(`C backend exited with code ${code}. Error: ${errorOutput}`);
            res.status(500).json({ error: 'Failed to generate crossword.', details: errorOutput });
        }
    });
});

app.post('/api/checkAnswer', async (req, res) => {
    const { word_id, user_word } = req.body;
    if (!word_id || !user_word) {
        return res.status(400).json({ error: 'Missing word_id or user_word.' });
    }
    try {
        const { rows } = await pool.query('SELECT word FROM "crossword_words" WHERE id = $1', [word_id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Word not found.' });
        const isCorrect = (user_word.toUpperCase() === rows[0].word.toUpperCase());
        res.json({ correct: isCorrect, scoreDelta: isCorrect ? 10 : 0 });
    } catch (error) {
        console.error('DB error in /api/checkAnswer:', error);
        res.status(500).json({ error: 'DB error during answer check.' });
    }
});

app.post('/api/endGame', isAuthenticated, async (req, res) => {
    const { score, timeTaken, wordsSolved } = req.body;
    const userId = req.session.user.id;
    if (score === undefined || timeTaken === undefined || !wordsSolved) {
        return res.status(400).json({ error: 'Missing game data.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: userRows } = await client.query('SELECT has_started_game FROM "users" WHERE id = $1 FOR UPDATE', [userId]);
        if (userRows.length === 0 || !userRows[0].has_started_game) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'You must start the game before submitting a result.' });
        }

        const { rowCount } = await client.query('SELECT 1 FROM "player_games" WHERE user_id = $1 LIMIT 1', [userId]);
        if (rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'You have already submitted your one allowed attempt.' });
        }

        await client.query(
            'INSERT INTO "player_games" (user_id, score, time_taken, words_solved) VALUES ($1, $2, $3, $4)',
            [userId, score, timeTaken, JSON.stringify(wordsSolved)]
        );
        await client.query(
            'UPDATE "users" SET total_score = total_score + $1, games_played = games_played + 1, highscore = GREATEST(highscore, $1) WHERE id = $2',
            [score, userId]
        );
        await client.query('COMMIT');
        res.json({ status: 'Game data saved successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('DB error in /api/endGame:', error);
        res.status(500).json({ error: 'DB error when saving game.' });
    } finally {
        client.release();
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM leaderboard ORDER BY highscore DESC LIMIT 10');
        res.json(rows);
    } catch (error) {
        console.error('DB error in /api/leaderboard:', error);
        res.status(500).json({ error: 'DB error when fetching leaderboard.' });
    }
});

app.get('/api/scores', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT u.username, pg.score, pg.time_taken, pg.play_date FROM "player_games" pg JOIN "users" u ON pg.user_id = u.id ORDER BY pg.score DESC, pg.time_taken ASC LIMIT 10');
        res.json(rows);
    } catch (error) {
        console.error('DB error in /api/scores:', error);
        res.status(500).json({ error: 'DB error when fetching scores.' });
    }
});

app.delete('/api/scores', isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE "player_games" RESTART IDENTITY');
        await client.query('UPDATE "users" SET score = 0, total_score = 0, highscore = 0, games_played = 0, wins = 0, losses = 0, has_started_game = false, game_started_at = NULL');
        await client.query('COMMIT');
        res.status(200).json({ status: 'All game logs, scores, and attempts deleted successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('DB error in /api/scores DELETE:', error);
        res.status(500).json({ error: 'DB error when deleting scores.' });
    } finally {
        client.release();
    }
});

app.delete('/api/users/scores', isAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE "users" SET total_score = 0, highscore = 0, games_played = 0, wins = 0, losses = 0, has_started_game = false, game_started_at = NULL');
        res.status(200).json({ status: 'All user scores have been reset to 0.' });
    } catch (error) {
        console.error('DB error in /api/users/scores DELETE:', error);
        res.status(500).json({ error: 'DB error when resetting user scores.' });
    }
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'signup.html')));
app.get('/help', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'help.html')));
app.get('/leaderboard', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'leaderboard.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'admin-login.html')));
app.get('/admin/dashboard', isAdmin, (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'admin', 'dashboard.html')));
app.get('/admin/delete-scores', isAdmin, (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'admin', 'delete-scores.html')));
app.get('/admin/reset-leaderboard', isAdmin, (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'admin', 'reset-leaderboard.html')));

server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
