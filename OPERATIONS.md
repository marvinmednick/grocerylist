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

2.  **Initialize Database**:
    *   Navigate to the SQL Editor in your Supabase dashboard.
    *   Open `supabase/full_schema.sql` from this repository.
    *   Paste the content into the SQL Editor and run it. This script:
        *   Creates all necessary tables (`stores`, `categories`, `items`, `list_items`, `units`).
        *   Sets up Row Level Security (RLS) policies.
        *   **Seeds initial data** for Categories, Stores, and Units.

    *Note: If you prefer to run migrations individually, the source files are located in `supabase/migrations/`.*

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
        ```

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

## Stopping the Application
*   To stop the Metro Bundler, press `Ctrl + C` in the terminal where it is running.

## Troubleshooting
*   **Network Issues**: If using a physical device, ensure it is on the same Wi-Fi network as your computer.
*   **Database Connection**: Double-check your `.env` values. Ensure RLS (Row Level Security) policies in `full_schema.sql` allow access (the schema includes policies for public access or authenticated users depending on configuration).
*   **Missing Data**: If the app loads but lists are empty, check if `full_schema.sql` ran successfully, particularly the seed data section at the end.