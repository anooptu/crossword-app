# ABC Cricket Crossword

A single-player cricket crossword game run by ABC. The app uses a C backend for dynamic puzzle generation, a Node.js/Express.js server, PostgreSQL for scores and sessions, and a vanilla HTML/CSS/JS frontend.

## Source / Attribution

This project is adapted from the original repository: https://github.com/Piyush-Rwt/crossword_project


## Features

- **Dynamic Crossword Generation:** The C backend algorithmically generates a new, random crossword puzzle for each game.
- **User Authentication:** Players can sign up and log in to track their scores and progress.
- **Interactive Grid:** Play the game in your browser with an interactive grid and clue lists.
- **Scoring & Answer Checking:** Your answers are checked in real-time, and a score is maintained.
- **High Score Leaderboard:** The game saves high scores to a PostgreSQL database.
- **One Official Attempt:** Participants can start and submit the cricket crossword only once.

## Project Overview

This project is a full-stack web application that allows users to play a dynamically generated cricket crossword puzzle run by ABC.

The architecture consists of three main parts:
1.  **Frontend:** A responsive, browser-based client built with vanilla HTML, CSS, and JavaScript that handles user interaction, renders the crossword grid, and communicates with the backend through REST APIs.
2.  **Backend:** A Node.js server using the Express.js framework. It manages user authentication, attempt tracking, answer checking, scoring, and leaderboard data.
3.  **Puzzle Generator:** A high-performance C program that is executed by the Node.js server to generate unique crossword puzzles on demand from a given word list.

## Backend Logic & Algorithms

The server-side logic is centered around three key areas:

### 1. Crossword Generation Algorithm

To ensure fast and unique puzzle creation, the core generation logic is written in C and executed as a child process by the Node.js server. The algorithm used is a form of **recursive backtracking**:

1.  **Initialization:** A grid of a specified size is created, and a word list is loaded from `data/words.txt`.
2.  **First Word Placement:** A random word is selected and placed horizontally or vertically near the center of the grid.
3.  **Iterative Intersection:** The algorithm then iterates through the letters of the words already on the grid, treating them as potential intersection points.
4.  **Word Fitting:** For each intersection point, it searches for a new, unused random word that contains the intersecting letter. It then attempts to place this new word on the grid, crossing the existing word.
5.  **Validation & Backtracking:** If a new word can be placed without overlapping incorrectly with other words or going out of bounds, it is added to the grid. If it cannot be placed, the algorithm "backtracks" by trying a different random word or moving to a different intersection point.
6.  **Completion:** This process repeats until the grid is reasonably full or a target number of words has been placed. The final grid and clues are then serialized to a JSON string and returned to the Node.js server.

### 2. Attempt Tracking

Each participant gets one official attempt. The server marks a user's attempt as started as soon as the crossword is generated. After submission, the score is stored and duplicate submissions are blocked by both server logic and a database uniqueness constraint.

---

## Technical Deep Dive

This section provides a more detailed breakdown of each component of the application.

### Frontend

The frontend is a client-side application built with vanilla HTML, CSS, and JavaScript. It is responsible for all user-facing presentation and interaction.

- **Responsibilities:**
    - **UI Rendering:** Dynamically renders the crossword grid, clue lists, forms, and modals based on data received from the server.
    - **User Input:** Captures all user input, including filling out the crossword, clicking buttons (Login, Forfeit, Finish Game), and submitting forms.
    - **State Management:** Manages client-side state, such as the game timer and the content of input fields.
    - **Server Communication:** Interacts with the backend through two methods:
        1.  **REST API Calls:** Uses `fetch` for stateless actions like user signup, login, and fetching leaderboard data.

### Backend (Node.js)

The Node.js backend, built with the Express.js framework, acts as the central nervous system of the application, connecting all other parts.

- **Key Responsibilities:**
    - **Orchestration:** Manages the overall flow of the application, from user authentication to initiating the C-based puzzle generator.
    - **Business Logic:** Handles game logic, such as checking answers, calculating scores, enforcing one attempt per user, and maintaining leaderboard data.

- **API Endpoints & Connections:**
    - `POST /api/signup`: Creates a new user account.
    - `POST /api/login`: Authenticates a user and creates a session.
    - `GET /api/generateCrossword`: Executes the C backend to generate a new puzzle for single-player mode.
    - `POST /api/endGame`: Saves a player's score and stats after a single-player game.
    - `GET /api/leaderboard`: Retrieves the top player scores.
- **Key Node.js Dependencies:**
| Dependency | Purpose |
| :--- | :--- |
| `express` | Core web server framework for handling routes and middleware. |
| `pg` | PostgreSQL client for connecting to and querying the database. |
| `bcryptjs` | Hashes and verifies user passwords securely. |
| `express-session` | Manages user sessions and login state. |
| `connect-pg-simple`| Stores session data directly in the PostgreSQL database. |

### Database (PostgreSQL)

The database is the application's persistent storage layer and acts as the single source of truth for all user and game data.

- **Key Tables & Views:**
    - `users`: Stores user account information, including username, hashed password, aggregate stats, and attempt tracking.
    - `player_games`: Records the result of each completed crossword attempt, linked to a user via `user_id`.
    - `leaderboard` (View): A pre-sorted view of the `users` table, providing a ranked list of players by their `highscore`.

### C Backend (Puzzle Generator)

This is a standalone C program responsible for the CPU-intensive task of generating crossword puzzles. It is designed for performance and is called by the Node.js server.

- **Data Structures:**
    - **Grid Representation:** A **2D character array** (`char grid[HEIGHT][WIDTH]`) is used to represent the crossword grid.
        - **Why:** This provides O(1) (constant time) access to any cell on the grid, which is essential for the algorithm's core logic of checking for valid placement and finding intersections. It is simple, memory-efficient, and fast.
    - **Word Storage:** A **dynamic array of strings** (`char* words[]`) holds the word list loaded from the `words.txt` file.
        - **Why:** A dynamic array allows the program to handle a word list of any size without a hardcoded limit.
    - **Clue Management:** A **struct** is used to model each word placed on the grid. This struct likely contains the word string, its starting (row, col), its direction (Across/Down), and its clue number. A **dynamic array of these structs** is used to build the list of clues that gets returned to the Node.js server.
        - **Why:** Using a struct logically groups all the related data for a single clue, making the code cleaner and easier to manage. An array of these structs is a straightforward way to manage the collection of all placed words.

## Tech Stack

- **Backend:** C (for puzzle generation), Node.js, Express.js, and `bcryptjs` for password hashing.
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Database:** PostgreSQL

---

## Project Setup (Local Development)

Follow these steps to get the application running on your local machine.

### 1. Prerequisites

- A C compiler (like **GCC** or an equivalent toolchain).
- **Node.js** and **npm**.
- A running **PostgreSQL** server.

### 2. Database Setup

1.  **Connect to your PostgreSQL server** and create a database. For example:
    ```sql
    CREATE DATABASE crossword_db;
    ```
2.  **Connect to the new database** (e.g., using `psql crossword_db` or a GUI tool).
3.  **Create the tables** by running the SQL commands found in `backend/database.sql`.

### 3. Environment Configuration

1.  In the root of the project, create a new file named `.env`.
2.  Copy `.env.example` to `.env`, then replace the placeholder values with your local database connection string and private secrets.
    ```
    DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/crossword_db"
    SESSION_SECRET="a_long_random_string_for_sessions"
    ADMIN_PASSWORD_HASH="bcrypt_hash_for_admin_password"
    ```
    *Note: For local development, you also need to install `dotenv`. Run `npm install dotenv`.*

### 4. Install Dependencies & Compile

Navigate to the project root directory and run:

```bash
# Install Node.js packages
npm install

# Compile the C backend
gcc backend/main.c -o backend/main
```

### 5. Running the Application Locally

From the project root, start the server:
```bash
node server.js
```
Then, open your web browser and go to: [http://localhost:3000](http://localhost:3000)

---

## Deployment on Render

This application is configured for deployment on [Render](https://render.com/) using its Git-based workflow. When you push changes to your connected GitHub repository, Render will automatically build and deploy the new version of your application.

### Step 1: Create the PostgreSQL Database

Before creating the application server, set up the database first.

1.  From your Render dashboard, click **New > PostgreSQL**.
2.  Give it a unique name (e.g., `crossword-db`) and choose a region.
3.  Click **Create Database**.
4.  Once it's created, go to the database's page and look for the **"Internal Connection String"**. Copy this URL; you will need it for the `DATABASE_URL` environment variable later.

### Step 2: Create the Web Service

This is the Node.js application server.

1.  From your Render dashboard, click **New > Web Service**.
2.  Connect the GitHub repository you forked for this project.
3.  In the settings form, enter the following:
    - **Name:** Give your app a name (e.g., `crossword-app`).
    - **Build Command:** `./render-build.sh`
        - *Why? This script is crucial because it installs the C compiler (`build-essential`) needed to compile your `backend/main.c` file before starting the server.*
    - **Start Command:** `node server.js`
        - *Why? This is the command that runs your main Node.js application after the build is complete.*

### Step 3: Add Environment Variables

Before the first build, you must add your project's secrets. Go to the **Environment** tab for your newly created Web Service and add the following variables:

-   `DATABASE_URL`: Paste the "Internal Connection String" you copied from your Render PostgreSQL database in Step 1.
-   `SESSION_SECRET`: A long, random string for session security. You can create one locally using `openssl rand -hex 32` or use an online generator.
-   `ADMIN_PASSWORD_HASH`: The bcrypt hash for the admin login. Generate your own hash and keep the original password private.

### Step 4: Deploy

Click the **Create Web Service** button. The initial build will take a few minutes. Once deployed, your application will be live at the URL provided by Render. You can monitor the build and server logs from the Render dashboard to ensure everything starts correctly.

---
## Troubleshooting & Design Notes

*   **`bcrypt` vs `bcryptjs`**: This project uses `bcryptjs` (the pure JavaScript version) instead of `bcrypt` (the native C++ version). While `bcrypt` is faster, it requires a native compiler toolchain in the deployment environment. Early deployment attempts failed because of issues with installing this native dependency on Render. Switching to `bcryptjs` removes this build complexity, leading to a much more reliable deployment process at a negligible performance cost for this application's scale.

## Project Structure

```
crossword_project/
├── backend/
│   ├── main.c              # C code for crossword generation
│   ├── database.sql        # Database schema
│   └── debug.bat           # Windows script to compile and run
├── data/
│   └── words.txt           # Word list for the generator
├── frontend/
│   ├── css/
│   │   └── style.css       # All styles for the application
│   ├── js/
│   │   ├── *.js            # Various frontend JavaScript files
│   ├── admin/
│   │   └── *.html          # Admin panel pages
│   └── *.html              # Main frontend pages
├── node_modules/           # Project dependencies
├── .env.example            # Example environment file
├── package.json            # Project metadata and dependencies
├── render-build.sh         # Build script for Render
└── server.js               # Node.js server
```
