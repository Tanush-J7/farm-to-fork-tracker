# FarmChain AI

FarmChain AI is a farm-to-fork traceability platform that combines a React dashboard, Node.js API, Supabase persistence, FastAPI-based AI predictions, and a Solidity smart contract.

## What it includes

- Role-based registration and JWT authentication for admin, farmer, processor, distributor, retailer, and consumer accounts
- Farmer product registration and product history views
- AI-assisted quality and shelf-life predictions during product registration
- Dashboard views for each supply-chain role
- A Hardhat/Solidity contract for immutable product registration, stage updates, and ownership transfers
- A consumer tracking route at `/track`

## Architecture

| Service | Technology | Default URL |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS | `http://localhost:5173` |
| API | Node.js, Express, TypeScript | `http://localhost:5000` |
| AI service | FastAPI, Python | `http://localhost:8000` |
| Data store | Supabase | Configured through environment variables |
| Blockchain | Solidity, Hardhat | Local Hardhat network |

## Prerequisites

- Node.js 20 or later
- Python 3.11 or later (full local stack only)
- A Supabase project (full local stack only)
- Optional: MetaMask for local blockchain interaction

## Quick start (frontend only — uses deployed Render API)

If the backend is already deployed on Render, your friend only needs Node.js. No Supabase, Python, or backend `.env` setup is required.

```bash
git clone https://github.com/YOUR_USERNAME/farm-to-fork-tracker.git
cd farm-to-fork-tracker
npm run setup:frontend
npm run dev:frontend
```

Open `http://localhost:5173`. The frontend talks to the deployed API at `https://farm-to-fork-tracker.onrender.com/api` by default.

**Windows — "running scripts is disabled":** use Command Prompt instead of PowerShell, or double-click [`start-frontend.bat`](start-frontend.bat) in the project folder.

If API calls fail with a CORS error, set `CORS_ORIGIN` on Render to `*` or include `http://localhost:5173` (Render dashboard → **farmchain-api** → **Environment**).

> **Note:** Render free-tier services sleep after ~15 minutes of inactivity. The first request after sleep can take 30–60 seconds to wake up.

## Full local setup (all services)

### 1. Install dependencies

From the repository root:

```bash
npm run setup
```

This installs root, frontend, backend, and blockchain Node dependencies, plus the Python packages for the AI service. You need **Node.js 20+** and **Python 3.11+** on your PATH (`node`, `npm`, and `python` must work in the terminal).

On Windows PowerShell, if `python` is not found, try `py -3.11` instead and adjust the `dev` scripts in [`package.json`](package.json) accordingly.

### 2. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a free project.
2. Open **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`
3. Open **SQL Editor**, paste the contents of [`backend/supabase/schema.sql`](backend/supabase/schema.sql), and run it.

### 3. Configure the API

Copy the example environment file and fill in your Supabase values:

```bash
cd backend
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
```

Required variables in `backend/.env`:

```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=replace_with_a_secure_random_secret
AI_SERVICE_URL=http://localhost:8000
```

Keep `.env` private—only `.env.example` belongs in source control.

### 4. Configure the frontend (local backend only)

Only needed when running the API locally. Skip this section if you use the deployed Render API.

```bash
cd frontend
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
```

```env
VITE_API_URL=http://localhost:5000/api
VITE_CONTRACT_ADDRESS=your_deployed_contract_address
```

## Run locally

From the repository root, start the full development environment with one command:

```bash
npm run dev
```

This launches the frontend, API, AI service, and local Hardhat blockchain. Stop every service with `Ctrl+C`. To start only the frontend, API, and AI service (no blockchain), use `npm run dev:app`.

After the Hardhat node is ready, deploy the local contract in a second terminal:

```bash
npm run deploy:local
```

The deployment prints a contract address. Add it to `frontend/.env` as `VITE_CONTRACT_ADDRESS`, then restart the frontend if you want to use blockchain wallet features.

### Individual services

You can also start each service in a separate terminal:

```bash
# AI service
cd ai-service
python -m uvicorn main:app --reload --port 8000
```

```bash
# API
cd backend
npm run dev
```

```bash
# Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173`.

Health checks:

```text
API: http://localhost:5000/health
AI:  http://localhost:8000/health
Docs: http://localhost:8000/docs
```

## Local blockchain (optional)

```bash
# Terminal 1
cd blockchain
npx hardhat node

# Terminal 2
cd blockchain
npx hardhat run scripts/deploy.ts --network localhost
```

Then place the deployed contract address in `frontend/.env` as `VITE_CONTRACT_ADDRESS`. For MetaMask, use the local RPC at `http://127.0.0.1:8545` and the chain ID reported by the Hardhat node.

## Deploy the API and AI service to Render

The repository includes [`render.yaml`](render.yaml), which deploys two Render web services:

- `farmchain-api` — the Express API
- `farmchain-ai` — the FastAPI prediction service

In Render, select **New → Blueprint**, connect this GitHub repository, and choose `render.yaml`. Before the first deploy, provide these API environment variables in Render:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CORS_ORIGIN=https://your-frontend-domain
```

Render generates `JWT_SECRET` and connects `AI_SERVICE_URL` to the AI service automatically. Do not set a production `PORT`; Render provides it. Once deployed, confirm the API at `https://your-api.onrender.com/health`.

To deploy the frontend elsewhere, set its build-time environment variable to the public API URL:

```env
VITE_API_URL=https://your-api.onrender.com/api
```

After changing `VITE_API_URL` or `CORS_ORIGIN`, redeploy the affected service. Never put Supabase service-role keys in frontend variables or commit them to Git.

## API overview

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Public |
| `POST` | `/api/auth/login` | Public |
| `GET` | `/api/products` | Authenticated |
| `GET` | `/api/products/my` | Farmer or admin |
| `POST` | `/api/products` | Farmer or admin |

Authenticated product routes expect an `Authorization: Bearer <token>` header.

## AI endpoints

The AI service exposes prediction endpoints for quality, disease, shelf life, price, demand, and fraud analysis:

```text
POST /predict/quality
POST /predict/disease
POST /predict/shelf-life
POST /predict/price
POST /predict/demand
POST /predict/fraud
```

Interactive request documentation is available at `http://localhost:8000/docs` while the service is running.

## Repository layout

```text
frontend/     React application
backend/      Express API and Supabase schema
ai-service/   FastAPI prediction service
blockchain/   Hardhat project and FarmChain contract
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Frontend loads but API calls hang or fail | Render free tier asleep | Wait 30–60 seconds and retry the request |
| CORS error in browser console | Render `CORS_ORIGIN` too restrictive | Set `CORS_ORIGIN` to `*` or add `http://localhost:5173` on Render |
| `running scripts is disabled` (Windows) | PowerShell blocks `npm` scripts | Use **Command Prompt** instead, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once in PowerShell (as your user), then retry |
| Backend crashes on start (local dev) | No `backend/.env` file | Copy `backend/.env.example` to `backend/.env` and fill in Supabase values |
| `Missing SUPABASE_SERVICE_ROLE_KEY` | Wrong variable name in `.env` | Use `SUPABASE_SERVICE_ROLE_KEY`, not `SUPABASE_SERVICE_KEY` |
| Login/register returns database errors | Supabase tables not created | Run `backend/supabase/schema.sql` in the Supabase SQL editor |
| `python` not found when running `npm run dev` | Python not installed or not on PATH | Install Python 3.11+ and ensure `python --version` works |
| AI predictions fail (local dev) | AI service not running | Confirm `http://localhost:8000/health` returns OK |

## Security

- Do not commit `.env` files, Supabase service-role keys, passwords, or JWT secrets.
- The Supabase service-role key must remain server-side; never place it in the frontend environment.
- Use a strong, unique `JWT_SECRET` outside local development.
