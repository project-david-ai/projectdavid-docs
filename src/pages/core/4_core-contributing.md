---
title: Contributing
slug: core-contributing
category: core
nav_order: 4
---

# Contributing

Project David Core owns the runtime, resource APIs, inference orchestration and tool execution. Project David Platform owns the packaged deployment interface. Choose the repository that owns the change.

| Repository | Scope |
|---|---|
| [Project David Core](https://github.com/project-david-ai/projectdavid-core) | Runtime, APIs, tools and database migrations |
| [Project David Platform](/docs/platform-contributing) | Deployment CLI and packaged infrastructure |

Check the [Core issue tracker](https://github.com/project-david-ai/projectdavid-core/issues) before starting. Discuss changes to public APIs, architecture or runtime dependencies before implementing them.

## Development setup

Fork Core on GitHub, then clone your fork. Replace `YOUR_GITHUB_USERNAME` with your account name.

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/projectdavid-core.git
cd projectdavid-core
git fetch origin
git switch -c feat/your-description origin/dev
```

Synchronize your fork's `dev` branch with upstream before branching. Use a dedicated Python environment and a Python version supported by the target revision. Install the checkout and the development dependencies declared by that revision; do not copy dependency pins from older guides.

```bash
python -m venv .venv
```

Activate it on Linux or macOS:

```bash
source .venv/bin/activate
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

From the Core root, install the package and configure the repository's pre-commit hooks after installing its development tooling:

```bash
python -m pip install -e .
pre-commit install
```

Use [Development commands](/docs/docker_commands) to initialize and inspect the local stack. Keep development credentials and persistent data separate from deployed environments.

## Validate changes

Run the relevant tests and the checks configured in the current repository. Add regression coverage for bug fixes and test new behaviour at the appropriate boundary.

```bash
python -m pytest tests/unit/
pre-commit run --all-files
```

Integration tests may require a running stack, provider credentials or other external services. Inspect their prerequisites before running them; do not assume they are offline or cost-free.

For a runtime defect, reproduce it and verify the fix in the existing development container where practical before rebuilding release images. For database changes, follow the migration procedure rather than editing the live schema ad hoc.

## Submit a change

Keep changes focused and inspect the diff before committing. Use [Conventional Commits](https://www.conventionalcommits.org/) and open a pull request against `dev`.

```bash
git diff --check
git push -u origin feat/your-description
```

Include the purpose, tests performed, relevant compatibility implications and any remaining verification limits. Do not commit credentials, local environment files or unrelated generated output. Review the repository's current CI and release configuration instead of assuming specific tool versions or version-bump rules.

## License

Review the licence in the repository at the target revision before contributing or using the software. The repository licence is authoritative.

## Reference

- [Development commands](/docs/docker_commands)
- [Project David Core](/docs/core-overview)
- [Container architecture](/docs/infrastructure-container-map)
- [Core configuration](/docs/core-configuration)
- [Upgrading Core](/docs/core-upgrading)
- [Database migrations](/docs/Migrations)
- [Inference integrations](/docs/adding_new_inference_provider)
- [Platform contributions](/docs/platform-contributing)
