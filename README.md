# Connect Four

A modern, animated web-based Connect Four game. Challenge an AI opponent with real-time animations, sound effects, and move history tracking.

![Game Screenshot](frontend/public/screenshot.png)

## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Training & AI](#training--ai)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Smooth Animations**: CSS keyframe disc drops, bounce effects, and slide-in move history sidebar.
- **Sound & Haptics**: Click, drop, and victory chimes with optional device vibration.
- **Real-Time Play**: Socket.io-powered NestJS backend for seamless gameplay.
- **Smart AI**: Python-based ML inference service with continuous learning capabilities.
- **Responsive UI**: Mobile-friendly design with intuitive controls and clear visual feedback.

## Demo

![Move History Sidebar](frontend/public/demo-sidebar.gif)  
*Slide-in move history panel showing past moves.*

## Tech Stack

- **Frontend**: React (TypeScript), Tailwind CSS, Socket.io-client
- **Backend**: NestJS, Socket.io, TypeScript
- **AI Service**: Uvicorn/FastAPI, Python 3, PyTorch/TensorFlow
- **CI/CD**: GitHub Actions, Docker

## Getting Started

### Prerequisites

- Node.js v16+ and npm or yarn
- Python 3.8+ with pip
- Bash shell
- [Optional] Poetry for Python environment management

### Installation

```bash
git clone https://github.com/drussell23/Connect-Four.git
cd Connect-Four

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..

# Install AI/ML service dependencies
cd ml_service && poetry install || pip install -r requirements.txt && cd ..
```

#### Environment Variables

Create `.env` files as needed in `frontend` and `backend`:

```
# frontend/.env
REACT_APP_API_URL=http://localhost:3000

# backend/.env
PORT=3000
```

## Usage

#### Start Frontend
```bash
cd frontend && npm start
```
Open http://localhost:3001 in your browser.

#### Start Backend
```bash
cd backend && npm run start:dev
```
Server listens on http://localhost:3000.

#### Start AI Service
```bash
cd ml_service && uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
```

## Training & AI

- **Offline Training** (self-play):
  ```bash
  ./scripts/run_pipeline.sh offline
  ```
- **Continuous Learning** (human vs AI logs):
  ```bash
  ./scripts/run_pipeline.sh continuous
  ```
- **Hybrid Mode**:
  ```bash
  ./scripts/run_pipeline.sh both --serve --interval 10
  ```

## Project Structure

```
Connect-Four/
├── backend/          # NestJS WebSocket & REST API
├── frontend/         # React user interface
├── ai/               # Core AI algorithms & self-play scripts
├── ml_service/       # Inference & training API service
├── scripts/          # Training & CI/CD pipelines
├── models/           # Trained model checkpoints
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/awesome`)
3. Commit your changes (`git commit -m 'feat: awesome feature'`)
4. Push to your branch (`git push origin feature/awesome`)
5. Open a Pull Request

## License

MIT © 2025 drussell23
