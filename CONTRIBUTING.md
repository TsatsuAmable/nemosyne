# Contributing to Nemosyne

Thank you for your interest in contributing! This document outlines how to get involved.

## Ways to Contribute

### Code
- Fix bugs
- Implement new features
- Improve tests
- Optimize performance

### Documentation
- Fix typos
- Write tutorials
- Improve API docs
- Translate content

### Design
- Create new artefact designs
- Propose UI improvements
- Color scheme refinements

### Community
- Answer questions in issues
- Share your visualizations
- Spread the word

## Development Setup

```bash
# Clone the repo
git clone https://github.com/TsatsuAmable/nemosyne.git
cd nemosyne

# Install dependencies
npm install

# Generate local HTTPS certificates for WebXR dev
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes

# Start the dev server
npm run dev

# Run tests
npm test

# Production build
npm run build
```

## Code Style

- Use ESLint and Prettier
- Follow existing patterns
- Write self-documenting code
- Add comments for complex logic

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add/update tests
5. Update documentation if needed
6. Commit with clear messages
7. Push to your fork
8. Open a Pull Request

## Commit Message Format

```
type: Short description

Longer explanation if needed.

Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Testing

All new features should include tests:

```bash
# Run tests
npm test

# Coverage report
npm run test:coverage
```

## Questions?

Open an issue with the `question` label.

---

*Thanks for helping make Nemosyne better!*
