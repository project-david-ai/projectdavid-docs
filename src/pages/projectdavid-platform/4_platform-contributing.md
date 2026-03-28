---
title: Contributing
slug: platform-contributing
category: projectdavid-platform
nav_order: 4
---

# Contributing

`projectdavid-platform` is the deployment orchestration layer for Project David. Contributions are welcome — packaging improvements, new compose overlays, CLI enhancements, and documentation corrections are all good candidates.

---

## Where the Code Lives

| Repository | What it contains |
|---|---|
| [projectdavid-platform](https://github.com/project-david-ai/projectdavid-platform) | The `pdavid` CLI, orchestrator, bundled compose files, and packaging |
| [projectdavid-core](https://github.com/project-david-ai/projectdavid-core) | The runtime engine — API, sandbox, training pipeline, Docker images |

If your contribution touches the runtime behaviour of the stack — inference, orchestration, tools, training — it belongs in **projectdavid-core**. If it touches deployment, packaging, CLI flags, or compose configuration — it belongs here.

---

## Development Setup

**1. Fork and clone the repository.**

```bash
git clone https://github.com/project-david-ai/projectdavid-platform.git
cd projectdavid-platform
```

**2. Create and activate a virtual environment.**

```bash
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

**3. Install the package in editable mode.**

```bash
pip install -e .
```

**4. Install development dependencies.**

```bash
pip install "black==24.1.1" "isort==5.13.2" "bandit" "mypy" "pytest" "pytest-cov"
```

**5. Install pre-commit hooks.**

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

```
feat/<description> → dev → main
```

| Branch | Purpose |
|---|---|
| `main` | Production — protected, semantic-release manages versions and Docker Hub publishes |
| `dev` | Integration — all feature branches merge here first |
| `feat/<description>` | Your work — branch from `dev`, merge back to `dev` |

```bash
git checkout dev
git pull origin dev
git checkout -b feat/your-description
```

**Never commit directly to `main` or `dev`.**

---

## Commit Message Convention

Project David uses [Conventional Commits](https://www.conventionalcommits.org/). Semantic-release reads commit messages to determine version bumps and Docker image tags automatically.

| Prefix | Version bump | When to use |
|---|---|---|
| `feat:` | Minor (`1.x.0`) | New CLI flag, new compose overlay, new capability |
| `fix:` | Patch (`1.0.x`) | Bug fix |
| `chore:` | No bump | Tooling, config, dependencies |
| `docs:` | No bump | Documentation only |
| `style:` | No bump | Formatting, no logic change |
| `refactor:` | No bump | Code restructure, no behaviour change |
| `test:` | No bump | Adding or fixing tests |
| `BREAKING CHANGE:` | Major (`x.0.0`) | Breaking CLI change — add in commit footer |

**Examples:**

```bash
git commit -m "feat: add --detach flag to pdavid logs"
git commit -m "fix: resolve port conflict check on Windows"
git commit -m "chore: upgrade docker-compose schema to v3.9"
git commit -m "docs: add scale-out example to platform overview"
```

**Never edit `CHANGELOG.md` manually.**

---

## CI Pipeline

The platform CI runs on every push to `main` and every pull request:

| Job | What it does |
|---|---|
| Lint Dockerfile | hadolint against all Dockerfiles |
| Docker Compose sanity check | `docker compose -f docker-compose.prod.yml build` |
| semantic-release | Version bump, changelog, Docker Hub publish |
| Build & Push | Builds and pushes `thanosprime/projectdavid-docs:latest` to Docker Hub |

A merged PR to `main` that passes CI will automatically trigger a new Docker Hub image push. No manual steps required.

---

## Adding a New Compose Overlay

Platform supports additive compose overlays for opt-in services (GPU, training, etc.). To add a new overlay:

**1. Create the compose file** in `projectdavid_platform/` — e.g. `docker-compose.myservice.yml`

**2. Register it** in `_BUNDLED_CONFIGS` in `start_orchestration.py`:

```python
_BUNDLED_CONFIGS = [
    ...
    ("docker-compose.myservice.yml", "docker-compose.myservice.yml"),
]
```

**3. Add a CLI flag** in the `main()` callback:

```python
myservice: bool = typer.Option(
    False,
    "--myservice",
    help="Start the myservice overlay.",
),
```

**4. Wire it** in `_compose_files()`:

```python
if getattr(self.args, "myservice", False):
    files += ["-f", self.myservice_compose]
```

**5. Resolve the path** — add a resolver in `__init__`:

```python
self.myservice_compose = _resolve_compose_file("docker-compose.myservice.yml")
```

---

## Submitting a Pull Request

**1. Push your branch.**

```bash
git push origin feat/your-description
```

**2. Open a PR against `dev`** — not `main`.

Go to [github.com/project-david-ai/projectdavid-platform](https://github.com/project-david-ai/projectdavid-platform) and open a pull request from `feat/your-description` → `dev`.

**3. CI must pass** — lint, compose check, and bandit all green.

**4. Once merged to `dev`**, it will be included in the next release cycle when `dev` is merged to `main`, which triggers the Docker Hub publish automatically.

---

## What We Welcome

- New compose overlay definitions for additional services
- CLI improvements — new flags, better error messages, improved preflight checks
- Windows and macOS compatibility fixes
- Performance improvements to the orchestrator startup sequence
- Documentation corrections and additions

## What We Ask You Not To Do

- Do not modify the generated `.env` structure without discussion — operators rely on the variable layout being stable across upgrades
- Do not add new required variables without a corresponding `configure` migration path
- Do not bypass pre-commit hooks with `--no-verify`

---

## License

By contributing to `projectdavid-platform` you agree that your contributions will be licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). Commercial use requires a separate licence — contact [engineering@projectdavid.co.uk](mailto:engineering@projectdavid.co.uk).

---

## Related

- [Project David Core — Contributing](/docs/core-contributing) — contributing to the runtime engine
- [Platform Overview](/docs/platform-overview) — quick start and stack modes
- [Platform Configuration](/docs/platform-configuration) — environment variable reference