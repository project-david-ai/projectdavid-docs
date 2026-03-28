---
title: Contributing
slug: core-contributing
category: core
nav_order: 4
---

# Contributing

Project David Core is open source under the PolyForm Noncommercial License 1.0.0. Contributions are welcome — bug fixes, documentation improvements, new inference provider integrations, and performance improvements are all good candidates.

---

## Before You Start

- Check the [issue tracker](https://github.com/project-david-ai/projectdavid-core/issues) to see if the work is already tracked
- For significant changes, open an issue first to discuss the approach before writing code
- All contributions must pass the Gold Standard CI pipeline before merging

---

## Development Setup

**1. Fork and clone the repository.**

```bash
git clone https://github.com/project-david-ai/projectdavid-core.git
cd projectdavid-core
```

**2. Create and activate a virtual environment.**

```bash
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

**3. Install the package and development dependencies.**

```bash
pip install -e .
pip install "black==24.1.1" "isort==5.13.2" "bandit" "mypy" "pytest" "pytest-cov"
```

**4. Install pre-commit hooks.**

```bash
pip install pre-commit
pre-commit install
```

The following hooks run automatically on every commit:

| Hook | What it checks |
|---|---|
| `trim-trailing-whitespace` | No trailing whitespace |
| `end-of-file-fixer` | Files end with a newline |
| `check-yaml` | Valid YAML syntax |
| `check-added-large-files` | No large files accidentally committed |
| `black` | Code formatted to 88-char line length |
| `isort` | Imports sorted and grouped correctly |
| `bandit` | No security issues in new code |

---

## Branch Convention

All work happens on feature branches. The flow is:

```
feat/<description> → dev → main
```

| Branch | Purpose |
|---|---|
| `main` | Production — protected, semantic-release manages versions |
| `dev` | Integration — all feature branches merge here first |
| `feat/<description>` | Your work — branch from `dev`, merge back to `dev` |

**Create your branch from `dev`:**

```bash
git checkout dev
git pull origin dev
git checkout -b feat/your-description
```

**Never commit directly to `main` or `dev`.**

---

## Commit Message Convention

Project David uses [Conventional Commits](https://www.conventionalcommits.org/) — semantic-release reads commit messages to determine version bumps automatically.

| Prefix | Version bump | When to use |
|---|---|---|
| `feat:` | Minor (`1.x.0`) | New feature or capability |
| `fix:` | Patch (`1.0.x`) | Bug fix |
| `chore:` | No bump | Tooling, config, dependencies |
| `docs:` | No bump | Documentation only |
| `style:` | No bump | Formatting, no logic change |
| `refactor:` | No bump | Code restructure, no behaviour change |
| `test:` | No bump | Adding or fixing tests |
| `BREAKING CHANGE:` | Major (`x.0.0`) | Breaking API change — add in commit footer |

**Examples:**

```bash
git commit -m "feat: add Mistral inference provider"
git commit -m "fix: resolve timeout in ollama streaming client"
git commit -m "chore: update bandit to 1.9.4"
git commit -m "docs: add vLLM configuration reference"
```

**Never edit `CHANGELOG.md` manually.** It is generated automatically by semantic-release on merge to `main`.

---

## Code Standards

**Formatting — Black**

All code is formatted with Black at 88-character line length. The pre-commit hook runs this automatically. To run manually:

```bash
black src/
```

**Import sorting — isort**

Imports are sorted with isort using the Black-compatible profile. Pin to `5.13.2` to match CI:

```bash
isort src/
```

**Security — Bandit**

Bandit runs against `src/` on every commit. If a finding is a known false positive, suppress it with a `# nosec` comment and a justification:

```python
subprocess.run(cmd, shell=True)  # nosec B602 — cmd is internally constructed, not user input
```

Global suppressions for structural patterns are configured in `.bandit.yml`.

**Type hints — Mypy**

Mypy runs non-blocking in CI due to the `src.api.*` import style used throughout the codebase. New code should include type hints where practical. The `mypy.ini` configuration is at the project root.

---

## Running Tests

```bash
pytest tests/ --cov=src --cov-report=term-missing
```

Unit tests live in `tests/`. Integration tests in `tests/integration/` are excluded from the default test run — they require a live stack:

```bash
pytest tests/integration/
```

---

## Submitting a Pull Request

**1. Push your branch.**

```bash
git push origin feat/your-description
```

**2. Open a PR against `dev`** — not `main`.

Go to [github.com/project-david-ai/projectdavid-core](https://github.com/project-david-ai/projectdavid-core) and open a pull request from `feat/your-description` → `dev`.

**3. CI must pass.** The Gold Standard pipeline runs:

- Ruff linter
- Black formatter check
- isort import check
- Bandit security analysis
- Mypy static analysis (non-blocking)
- Pytest unit tests (Python 3.11 and 3.12)

**4. Once merged to `dev`**, it will be included in the next release cycle when `dev` is merged to `main`.

---

## What We Welcome

- Bug fixes with a failing test that demonstrates the issue
- New inference provider integrations — follow the pattern in `src/api/entities_api/orchestration/handlers/`
- Performance improvements to the streaming pipeline
- Documentation improvements and corrections
- Additional unit test coverage

## What We Ask You Not To Do

- Do not open PRs that change the API primitives (Assistants, Threads, Messages, Runs, Tools) without prior discussion — these are the stability guarantee of the platform
- Do not add runtime dependencies without discussion — the dependency footprint is intentionally controlled
- Do not bypass pre-commit hooks with `--no-verify`

---

## License

By contributing to Project David Core you agree that your contributions will be licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). Commercial use of the project requires a separate licence — see [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk).

---

## Related

- [Project David Core](/docs/core-overview) — quick start and CLI reference
- [Configuration Reference](/docs/core-configuration) — environment variables
- [Upgrading Core](/docs/core-upgrading) — upgrade and migration guide