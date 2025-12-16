# Contributing to FABER

Thank you for your interest in contributing to FABER! This document provides guidelines for contributing to the project.

## Repository Structure

FABER is organized as a monorepo containing both JavaScript and Python SDKs:

```
faber/
├── sdk/
│   ├── js/                  # JavaScript/TypeScript SDK
│   │   ├── src/            # TypeScript source code
│   │   ├── dist/           # Compiled output (generated)
│   │   ├── package.json    # npm package (@fractary/faber)
│   │   ├── tsconfig.json   # TypeScript configuration
│   │   ├── jest.config.js  # Jest test configuration
│   │   └── .eslintrc.js    # ESLint configuration
│   └── py/                 # Python SDK
│       ├── faber/          # Python package
│       ├── tests/          # Python tests
│       ├── pyproject.toml  # Python package configuration
│       └── pytest.ini      # Pytest configuration
├── specs/                  # Design specifications
├── docs/                   # Documentation
├── .github/workflows/      # CI/CD workflows
└── package.json            # Root monorepo configuration
```

## Development Setup

### Prerequisites

- **Node.js** 18.0.0 or higher (for JavaScript SDK)
- **Python** 3.10 or higher (for Python SDK)
- **Git** for version control

### JavaScript SDK Development

```bash
# Navigate to JavaScript SDK
cd sdk/js

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the project
npm run build

# Lint code
npm run lint

# Type check
npm run typecheck
```

### Python SDK Development

```bash
# Navigate to Python SDK
cd sdk/py

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest

# Run tests with coverage
pytest --cov=faber

# Lint code
ruff check .

# Format code
ruff format .
```

### Running All Tests

From the repository root:

```bash
# Run all tests (both SDKs)
npm run test

# Build all SDKs
npm run build

# Lint all SDKs
npm run lint
```

## Making Changes

### Workflow

1. **Fork the repository** and clone your fork
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** in the appropriate SDK directory
4. **Write or update tests** for your changes
5. **Ensure all tests pass** and code is linted
6. **Commit your changes** with clear, descriptive messages
7. **Push to your fork** and create a pull request

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(js): Add support for custom issue templates

fix(py): Resolve checkpoint resume issue in workflows

docs: Update README with monorepo structure

test(js): Add integration tests for SpecManager
```

### Code Style

**JavaScript/TypeScript:**
- Follow the existing ESLint configuration
- Use TypeScript strict mode
- Prefer explicit types over `any`
- Write JSDoc comments for public APIs

**Python:**
- Follow PEP 8 guidelines
- Use type hints for function signatures
- Write docstrings for public APIs
- Use `ruff` for linting and formatting

## Testing

### JavaScript Tests

Tests are located alongside source files in `__tests__` directories:

```
sdk/js/src/
├── config.ts
├── config/
│   └── __tests__/
│       └── initializer.test.ts
└── __tests__/
    └── config.test.ts
```

Run specific test files:
```bash
cd sdk/js
npm test -- config.test.ts
```

### Python Tests

Tests are in the `sdk/py/tests/` directory:

```
sdk/py/
├── faber/
└── tests/
    ├── test_api.py
    ├── test_workflow_state.py
    └── test_definitions/
```

Run specific test files:
```bash
cd sdk/py
pytest tests/test_api.py
```

## Pull Request Process

1. **Ensure your PR addresses a single concern**
2. **Update documentation** if you're changing behavior
3. **Add or update tests** to maintain coverage
4. **Ensure CI passes** (all tests and lints)
5. **Request review** from maintainers
6. **Address feedback** promptly

### PR Checklist

- [ ] Tests pass locally
- [ ] Code is linted and formatted
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] No breaking changes (or clearly documented)
- [ ] CHANGELOG updated (if applicable)

## Package Publishing

**Note:** Only maintainers can publish packages.

### JavaScript SDK

```bash
cd sdk/js
npm version <major|minor|patch>
npm run build
npm test
npm publish
```

### Python SDK

```bash
cd sdk/py
# Update version in pyproject.toml
python -m build
twine upload dist/*
```

## Getting Help

- **Issues**: https://github.com/fractary/faber/issues
- **Discussions**: https://github.com/fractary/faber/discussions
- **Documentation**: https://github.com/fractary/faber#readme

## License

By contributing to FABER, you agree that your contributions will be licensed under the MIT License.
