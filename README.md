# Edtech Statistics Chat App


## 🚀 Features

- **Monorepo Architecture**: Backend (FastAPI) + Frontend (React + TypeScript)
- **Production-Ready Tooling**: Linting, formatting, testing, CI/CD, Docker
- **Modern Tech Stack**: Python 3.12, React 18, TypeScript, TailwindCSS
- **Security First**: CORS, security headers, non-root Docker containers
- **Developer Experience**: Pre-commit hooks, consistent scripts, comprehensive docs

## 🏗️ Tech Stack

### Backend
- **FastAPI** - Modern, fast web framework
- **Python 3.12** - Latest Python with type hints
- **Poetry** - Dependency management
- **Ruff** - Fast Python linter and formatter
- **MyPy** - Static type checking
- **Pytest** - Testing framework with coverage
- **Uvicorn** - ASGI server

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Vitest** - Fast unit testing
- **Testing Library** - React testing utilities

### DevOps & Quality
- **Docker** - Containerization with multi-stage builds
- **Docker Compose** - Local development orchestration
- **GitHub Actions** - CI/CD pipeline
- **Pre-commit** - Git hooks for code quality
- **ESLint + Prettier** - JavaScript/TypeScript linting and formatting

## 📁 Repository Layout

```
hthgse-shewhart-chatbot/
├── backend/                 # FastAPI backend application
│   ├── app/                # Application code
│   │   ├── core/          # Configuration and utilities
│   │   ├── api/           # API routes and endpoints
│   │   └── middleware/    # Custom middleware
│   ├── tests/             # Test suite
│   ├── pyproject.toml     # Poetry configuration
│   ├── Dockerfile         # Backend container
│   └── README.md          # Backend documentation
├── frontend/               # React frontend application
│   ├── src/               # Source code
│   │   ├── components/    # React components
│   │   ├── lib/          # Utility functions
│   │   └── tests/        # Test suite
│   ├── package.json       # Node.js dependencies
│   ├── Dockerfile         # Frontend container
│   └── README.md          # Frontend documentation
├── .github/               # GitHub configuration
│   └── workflows/         # CI/CD workflows
├── .vscode/              # VS Code settings
├── docker-compose.yml     # Local development orchestration
├── .pre-commit-config.yaml # Git hooks configuration
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.12+** and **Poetry 1.7.1+**
- **Node.js 20+** and **npm**
- **Docker** and **Docker Compose** (optional)

### Local Development

#### 1. Backend Setup

```bash
cd backend

# Install dependencies
poetry install

# Set up environment
cp env.example .env
# Edit .env with your configuration

# Start development server
poetry run uvicorn app.main:app --reload
```

Backend will be available at `http://localhost:8000`

#### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
cp env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

Frontend will be available at `http://localhost:5173`

### Docker Development

```bash
# Start both services
docker-compose up --build

# Or start individually
docker-compose up backend
docker-compose up frontend
```

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=app --cov-report=html

# Run linting
poetry run ruff check .

# Format code
poetry run ruff format .

# Type checking
poetry run mypy app
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm run test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## 🔧 Available Scripts

### Backend Scripts

```bash
# Development
poetry run uvicorn app.main:app --reload

# Code Quality
poetry run ruff check .          # Lint
poetry run ruff format .         # Format
poetry run mypy app              # Type check

# Testing
poetry run pytest                # Run tests
poetry run pytest --cov=app      # With coverage
```

### Frontend Scripts

```bash
# Development
npm run dev                      # Start dev server
npm run build                    # Build for production
npm run preview                  # Preview production build

# Code Quality
npm run lint                     # ESLint
npm run format                   # Prettier
npm run format:check            # Check formatting

# Testing
npm run test                     # Vitest
npm run test:ui                 # Test UI
npm run test:coverage           # With coverage
```

## 🌐 API Endpoints

- `GET /healthz` - Health check
- `GET /api/v1/healthz` - Versioned health check
- `GET /api/v1/` - API root information
- `GET /docs` - Swagger documentation (dev only)
- `GET /redoc` - ReDoc documentation (dev only)

## 🐳 Docker

### Backend Container

```bash
cd backend
docker build -t hthgse-shewhart-chatbot-backend .
docker run -p 8000:8000 hthgse-shewhart-chatbot-backend
```

### Frontend Container

```bash
cd frontend
docker build -t hthgse-shewhart-chatbot-frontend .
docker run -p 80:80 hthgse-shewhart-chatbot-frontend
```

### Full Stack with Docker Compose

```bash
docker-compose up --build
```

## 🔒 Security Features

- **CORS Protection**: Configurable allowed origins
- **Security Headers**: XSS protection, content type options, frame options
- **Trusted Hosts**: Restrict allowed host headers
- **Non-root Containers**: Docker containers run as non-privileged users
- **Environment Variables**: Secure configuration management

## 📊 Code Quality

- **Pre-commit Hooks**: Automatic code quality checks
- **Linting**: Ruff (Python) + ESLint (TypeScript)
- **Formatting**: Ruff (Python) + Prettier (TypeScript)
- **Type Checking**: MyPy (Python) + TypeScript compiler
- **Testing**: Pytest + Vitest with coverage reporting
- **CI/CD**: Automated testing and quality checks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Standards

- Follow **Conventional Commits** for commit messages
- Maintain **80%+ test coverage**
- All tests must pass before merging
- Use **pre-commit hooks** for code quality
- Follow **PEP 8** (Python) and **ESLint** (TypeScript) rules

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/hthgse-shewhart-chatbot/issues)
- **Documentation**: See individual `README.md` files in `backend/` and `frontend/` directories
- **API Docs**: Available at `/docs` when running in development mode

## 🗺️ Roadmap

- [ ] Authentication and authorization
- [ ] Database integration
- [ ] Real-time chat functionality
- [ ] Statistical process control features
- [ ] Quality management dashboard
- [ ] API rate limiting
- [ ] Monitoring and observability
- [ ] Kubernetes deployment manifests

---

**Built with ❤️ for quality management and statistical process control**
