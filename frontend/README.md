# HTHGSE Shewhart Chatbot - Frontend

React + TypeScript frontend for the HTHGSE Shewhart Chatbot project.

## Features

- **React 18** with modern hooks and functional components
- **TypeScript** for type safety and better developer experience
- **Vite** for fast development and building
- **TailwindCSS** for utility-first styling
- **Vitest** for fast unit testing
- **Testing Library** for React component testing
- **ESLint + Prettier** for code quality and formatting

## Prerequisites

- Node.js 20+
- npm or yarn

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp env.example .env
# Edit .env with your configuration
```

### 3. Start development server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Available Scripts

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Testing

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   └── Header.tsx      # Header component
│   ├── lib/                # Utility functions
│   │   └── api.ts          # API client functions
│   ├── tests/              # Test files
│   │   ├── setup.ts        # Test configuration
│   │   └── App.test.tsx    # App component tests
│   ├── App.tsx             # Main App component
│   ├── main.tsx            # Application entry point
│   └── styles.css          # Global styles, TailwindCSS
├── public/                 # Static assets
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.ts      # TailwindCSS configuration
├── postcss.config.js       # PostCSS configuration
├── Dockerfile              # Docker configuration
├── nginx.conf              # Nginx configuration for production
└── README.md               # This file
```

## Configuration

The application uses environment variables for configuration. See `env.example` for available options.

### Key Configuration

- `VITE_API_BASE_URL`: Backend API base URL
- `VITE_APP_TITLE`: Application title
- `VITE_APP_VERSION`: Application version

## Development

### Code Style

- Use TypeScript for all new code
- Follow React best practices and hooks guidelines
- Use functional components with hooks
- Write descriptive component and function names
- Use TailwindCSS utility classes for styling

### Testing

- Write tests for all new components
- Use Testing Library for component testing
- Test user interactions and component behavior
- Maintain good test coverage
- Use descriptive test names

### Git Hooks

The project uses pre-commit hooks for code quality:

```bash
# Install pre-commit hooks
pre-commit install

# Run hooks manually
pre-commit run --all-files
```

## Docker

### Build and run

```bash
# Build image
docker build -t hthgse-shewhart-chatbot-frontend .

# Run container
docker run -p 80:80 hthgse-shewhart-chatbot-frontend
```

### With Docker Compose

```bash
# From project root
docker-compose up frontend
```

## API Integration

The frontend integrates with the backend API through the `api.ts` module:

- **Health Check**: `/healthz` endpoint for backend status
- **API Root**: `/api/v1/` for API information
- **Error Handling**: Comprehensive error handling and user feedback

## Styling

- **TailwindCSS**: Utility-first CSS framework
- **Custom Components**: Reusable button and form components
- **Responsive Design**: Mobile-first responsive layout
- **Theme Support**: Custom color scheme and design tokens

## Testing

- **Vitest**: Fast unit testing framework
- **Testing Library**: React component testing utilities
- **JSDOM**: DOM environment for testing
- **Coverage**: Test coverage reporting

## Build and Deployment

- **Vite**: Fast build tool with HMR
- **TypeScript**: Compilation and type checking
- **PostCSS**: CSS processing and optimization
- **Nginx**: Production web server configuration

## License

MIT License - see LICENSE file for details.
