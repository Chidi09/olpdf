# Contributing to OLPDF

First off, thank you for considering contributing to OLPDF! It's people like you that make OLPDF such a great tool for the community.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. (TL;DR: Be kind, professional, and respectful).

## How Can I Contribute?

### Reporting Bugs
- Use the GitHub issue tracker.
- Describe the bug in detail, including steps to reproduce.
- Include information about your environment (OS, Browser, Python version, Node version).

### Suggesting Enhancements
- Open an issue with the "enhancement" label.
- Explain why the enhancement would be useful.

### Pull Requests
1. Fork the repository.
2. Create a new branch: `git checkout -b feature/my-new-feature`.
3. Make your changes.
4. Ensure all tests pass: `pnpm test`.
5. Run linting and type checking: `pnpm lint && pnpm typecheck`.
6. Commit your changes: `git commit -am 'Add some feature'`.
7. Push to the branch: `git push origin feature/my-new-feature`.
8. Submit a pull request.

## Development Setup

### Backend (FastAPI)
- Navigate to `apps/api`.
- Create a virtual environment: `python -m venv venv`.
- Install dependencies: `pip install -r requirements.txt`.
- Copy `.env.example` to `.env` and fill in the values.

### Frontend (Next.js)
- Navigate to the root.
- Install dependencies: `pnpm install`.
- Run development server: `pnpm dev`.

### Core Engine
The core extraction and export logic lives in `apps/api/engine/`. This is the heart of OLPDF and is designed to be high-performance and deterministic.

## Style Guide

- **Python**: Follow PEP 8. Use `ruff` for linting.
- **TypeScript**: Follow the existing patterns in `apps/web`. Use `eslint` and `prettier`.
- **Git**: Use clear, concise commit messages.

## Licensing

By contributing to OLPDF, you agree that your contributions will be licensed under the project's MIT License.
