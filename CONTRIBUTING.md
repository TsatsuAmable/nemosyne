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
cd nemosyne/framework

# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test
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

### Branch Protection Rules

**The `main` branch is protected. All changes must go through Pull Requests.**

#### Requirements for merging to `main`:
- ✅ **Pull Request required** - Direct pushes to `main` are blocked
- ✅ **CI must pass** - All status checks (`test`, `build`) must be green
- ✅ **Up-to-date branch** - Your branch must be current with `main`
- ✅ **1 approving review** - At least one maintainer must approve
- ✅ **No force pushes** - History rewriting is disabled
- ✅ **No deletions** - Branch deletion is disabled

**Note:** The CI runs automatically on every PR and includes:
- Unit tests (311+ tests)
- Build verification
- Linting

Make sure your PR passes all checks before requesting review.

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
