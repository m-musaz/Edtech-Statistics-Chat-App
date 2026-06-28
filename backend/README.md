# HTHGSE Shewhart Chatbot - Backend

FastAPI backend for the HTHGSE Shewhart Chatbot project.

## Features

- FastAPI with Python 3.12
- Poetry for dependency management
- Ruff for linting and formatting
- MyPy for type checking
- Pytest for testing with coverage
- Docker support with multi-stage builds
- Security middleware with CORS support
- Environment-based configuration

## Prerequisites

- Python 3.12+
- Poetry 1.7.1+

## Quick Start

### 1. Install dependencies

```bash
poetry install
```

### 2. Set up environment

```bash
cp env.example .env
# Edit .env with your configuration
```

### 3. Run the development server

```bash
poetry run uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## Available Scripts

### Development

```bash
# Start development server
poetry run uvicorn app.main:app --reload

# Start production server
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Code Quality

```bash
# Run linting
poetry run ruff check .

# Format code
poetry run ruff format .

# Run type checking
poetry run mypy app
```

### Testing

```bash
# Run tests
poetry run pytest

# Run tests with coverage
poetry run pytest --cov=app --cov-report=html

# Run tests in watch mode
poetry run pytest --watch
```

## API Endpoints

### Health Check

- `GET /healthz` - Health check endpoint
- `GET /api/v1/healthz` - API versioned health check

### API Documentation

- `GET /docs` - Swagger UI documentation (development only)
- `GET /redoc` - ReDoc documentation (development only)

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py        # Configuration settings
│   │   └── logging.py       # Logging configuration
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # API routes
│   └── middleware/
│       ├── __init__.py
│       └── security.py      # Security middleware
├── tests/
│   └── test_health.py       # Health check tests
├── pyproject.toml           # Poetry configuration
├── Dockerfile               # Docker configuration
├── env.example              # Environment variables template
└── README.md                # This file
```

## Configuration

The application uses environment variables for configuration. See `env.example` for available options.

### Key Configuration

- `PROJECT_NAME`: Project name
- `ENVIRONMENT`: Environment (development/production)
- `DEBUG`: Enable debug mode
- `CORS_ORIGINS`: Allowed CORS origins
- `SECRET_KEY`: Secret key for security
- `LOG_LEVEL`: Logging level

## Docker

### Build and run

```bash
# Build image
docker build -t hthgse-shewhart-chatbot-backend .

# Run container
docker run -p 8000:8000 hthgse-shewhart-chatbot-backend
```

### With Docker Compose

```bash
# From project root
docker-compose up backend
```

## Development

### Code Style

- Use Ruff for linting and formatting
- Follow PEP 8 guidelines
- Use type hints for all functions
- Write docstrings for all public functions

### Testing

- Write tests for all new functionality
- Maintain test coverage above 80%
- Use descriptive test names
- Group related tests in classes

### Git Hooks

The project uses pre-commit hooks for code quality:

```bash
# Install pre-commit hooks
pre-commit install

# Run hooks manually
pre-commit run --all-files
```

## License

MIT License - see LICENSE file for details.
