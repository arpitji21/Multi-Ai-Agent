# MediAI Hospital Suite

An AI-powered Hospital Management Platform built with React, Node.js, and PostgreSQL.

## Architecture

- **Frontend**: React + Vite + TailwindCSS (port 5000)
- **Backend**: Node.js + Express API (port 8000)
- **Database**: PostgreSQL (Replit built-in)
- **Auth**: JWT (15-min access tokens + 7-day refresh tokens) + RBAC

## Running the App

Two workflows must both be running:
1. **Backend API** — `cd server && node src/index.js`
2. **Start application** — `cd frontend && npm run dev`

The frontend Vite dev server proxies `/api` requests to the backend at `localhost:8000`.

## Demo Accounts

| Role    | Email                  | Password    |
|---------|------------------------|-------------|
| Admin   | admin@mediai.com       | admin123    |
| Doctor  | doctor@mediai.com      | doctor123   |
| Doctor  | drchen@mediai.com      | doctor123   |
| Patient | patient@mediai.com     | patient123  |

## Tech Stack

- React 18, Vite, TailwindCSS, Zustand, React Router v6, Lucide icons
- Node.js, Express, pg (PostgreSQL), bcryptjs, jsonwebtoken, multer
- helmet, cors, express-rate-limit, morgan

## Design

Dark glassmorphism theme. Brand red: `#ED2024`. Font: Inter.

## User Preferences

- Keep dark glassmorphism design with brand red #ED2024
- Maintain existing component and folder structure
