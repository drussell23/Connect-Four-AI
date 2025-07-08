# Connect-Four Game

This repository contains three main components for running and developing the Connect-Four game:

1. **Frontend (React)**: User interface for playing Connect-Four against the AI.
2. **Backend (NestJS)**: WebSocket server and REST API for managing gameplay.
3. **AI/ML Service (Python)**: AI inference and continuous learning system.

---

## Prerequisites

Ensure you have the following installed:

- **Node.js** v16+ and **npm** or **yarn**
- **Python** 3.8+ with **pip**
- **bash** shell (for running scripts)

Optional but recommended:
- **Poetry** (Python dependency management)

---

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/drussell23/Connect-Four.git
cd Connect-Four

# Backend setup
cd backend
npm install
cd ..

# Frontend setup
cd frontend
npm install
cd ..

# AI/ML Service setup
cd ml_service
poetry install  # if using Poetry
# or
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

---

## Running the Frontend

To start the React frontend locally:

```bash
cd frontend
npm start
```

Open **http://localhost:3000** to access the application.

For a production build:

```bash
npm run build
```

---

## Running the Backend

Start the NestJS backend server:

```bash
cd backend
npm run start:dev
```

The server runs on **http://localhost:3001**.

For production:

```bash
npm run build
npm run start:prod
```

---

## Running the AI/ML Service

Activate the Python environment and start the ML inference API:

```bash
cd ml_service
# Activate virtual environment if using venv
source .venv/bin/activate
uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
```

Check API status:

```bash
curl http://localhost:8000/health
```

The ML API provides move predictions at `/predict`.

---

## Training and Continuous Learning

Use provided scripts for training and continuous AI improvement.

- **Offline training** (AI plays against itself):

```bash
./scripts/run_pipeline.sh offline
```

- **Continuous learning** (train from human vs AI logs):

```bash
./scripts/run_pipeline.sh continuous
```

- **Hybrid (Offline + Continuous)**:

```bash
./scripts/run_pipeline.sh both --serve
# with custom interval:
./scripts/run_pipeline.sh both --serve --interval 10
```

`--serve` launches the inference server for logging human games.

---

## Directory Structure

```
Connect-Four/
├── backend/           # NestJS backend
├── frontend/          # React frontend
├── ai/                # Connect4 AI logic
├── backend/src/ml/    # Self-play & training scripts
├── ml_service/        # AI/ML inference and training service
├── models/            # Model checkpoints
├── scripts/           # Pipeline execution scripts
└── README.md
```

---

Enjoy developing and improving your Connect-Four AI!
