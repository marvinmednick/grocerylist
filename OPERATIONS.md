# Operational Guide

## Overview
This project is a collaborative grocery list application built with **React Native (Expo)** for the frontend and **Supabase** for the backend.

## Prerequisites
*   **Node.js** (LTS version recommended)
*   **npm** or **yarn**
*   **Expo Go** app (on iOS/Android) for physical device testing, or a simulator/emulator.
*   **Supabase Account** (for backend hosting) or **Supabase CLI** (for local development).

## Setup

### 1. Backend (Supabase)
1.  **Create a Project**:
    *   Go to [Supabase](https://supabase.com) and create a new project.
    *   Note your `Project URL` and `anon` (public) API Key from Project Settings > API.

2.  **Install Supabase CLI** (from the project root):
    ```bash
    npm install
    ```
    This installs the Supabase CLI as a dev dependency (see root `package.json`).

3.  **Link to your remote project**:
    *   Generate an access token at https://supabase.com/dashboard/account/tokens
    *   Add it to the root `.env` file:
        ```env
        SUPABASE_ACCESS_TOKEN=your-token-here
        ```
    *   Link:
        ```bash
        npx supabase link --project-ref <your-project-ref>
        ```

4.  **Apply migrations**:
    ```bash
    npm run db:push
    ```
    This applies any pending migrations from `supabase/migrations/` to your remote database. The CLI tracks which migrations have been applied (like Django migrations).

    *For a fresh database, you can alternatively paste `supabase/full_schema.sql` into the Supabase SQL Editor.*

### 2. Frontend (Client)
1.  **Navigate to Client Directory**:
    ```bash
    cd client
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Configuration**:
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Open `.env` and fill in your Supabase credentials:
        ```env
        EXPO_PUBLIC_SUPABASE_URL=your-project-url
        EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
        EXPO_PUBLIC_HOUSEHOLD_MODE=single
        ```
    *   **Household Mode:** `single` assigns all users to one shared household (default). Set to `multi` for per-user households with invite/join flow (requires additional UI).

## Running the Application

1.  **Start the Development Server**:
    In the `client` directory, run:
    ```bash
    npx expo start
    ```
    This command starts the Metro Bundler.

2.  **Launch on Device/Simulator**:
    *   **Physical Device**: Scan the QR code shown in the terminal with the **Expo Go** app (Android) or Camera app (iOS).
    *   **iOS Simulator**: Press `i` in the terminal (requires Xcode installed).
    *   **Android Emulator**: Press `a` in the terminal (requires Android Studio installed).
    *   **Web**: Press `w` in the terminal (runs in browser).

## Database Management (Supabase CLI)

All database commands are run from the **project root** (not `client/`). The root `.env` provides the `SUPABASE_ACCESS_TOKEN` automatically.

| Command | Description |
|---------|-------------|
| `npm run db:status` | Show which migrations are applied locally vs remote |
| `npm run db:push` | Apply pending migrations to the remote database |
| `npm run db:new <name>` | Create a new empty migration file with timestamp prefix |
| `npm run db:diff` | Generate a migration by diffing local vs remote schema |
| `npm run db:reset` | Reset the remote database and re-run all migrations |
| `npm run db:types` | Generate TypeScript types from the remote schema |

### Creating a New Migration
```bash
npm run db:new -- add_recipes
# Creates: supabase/migrations/YYYYMMDDHHMMSS_add_recipes.sql
# Edit the file, then:
npm run db:push
```

### Project Structure
```
grocery/
├── package.json          ← Root: Supabase CLI + db:* scripts only
├── .env                  ← SUPABASE_ACCESS_TOKEN (gitignored)
├── supabase/
│   ├── config.toml       ← CLI configuration (project_id, linked ref)
│   ├── full_schema.sql   ← Combined schema for fresh installs
│   └── migrations/       ← Timestamped migration files (tracked by CLI)
└── client/
    ├── package.json      ← Expo/React Native app dependencies
    └── .env              ← EXPO_PUBLIC_* variables (gitignored)
```

## Stopping the Application
*   To stop the Metro Bundler, press `Ctrl + C` in the terminal where it is running.

## Troubleshooting
*   **Network Issues**: If using a physical device, ensure it is on the same Wi-Fi network as your computer.
*   **Database Connection**: Double-check your `.env` values. Ensure RLS (Row Level Security) policies in `full_schema.sql` allow access (the schema includes policies for public access or authenticated users depending on configuration).
*   **Missing Data**: If the app loads but lists are empty, check if `full_schema.sql` ran successfully, particularly the seed data section at the end.