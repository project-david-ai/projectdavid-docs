---
title: Contributing
slug: platform-contributing
category: projectdavid-platform
nav_order: 4
---

# Contributing

`projectdavid-platform` provides the `pdavid` CLI, deployment orchestration, bundled Docker Compose configuration and package distribution. Contributions should improve the installation, operation or upgrade of Project David on self-hosted infrastructure.

Changes to inference, resource APIs, tools or agent execution belong in [Project David Core](https://github.com/project-david-ai/projectdavid-core).

## Development setup

Fork [projectdavid-platform](https://github.com/project-david-ai/projectdavid-platform) on GitHub. Replace `YOUR_GITHUB_USERNAME` with your GitHub username:

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/projectdavid-platform.git
cd projectdavid-platform
git remote add upstream https://github.com/project-david-ai/projectdavid-platform.git
git fetch upstream
git switch -c fix/deployment-check upstream/dev
```

Create an isolated Python environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

On Windows PowerShell, activate it with:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the package in editable mode:

```bash
python -m pip install -e .
pdavid --help
```

Use the development dependencies and checks declared in the repository for the branch you are working on. For deployment testing, you also need Docker with Compose and a valid Platform licence.

## Validate changes

Use a dedicated test runtime directory, separate from any existing deployment. Do not test destructive operations against production data.

Changes to generated configuration must account for existing deployments as well as fresh installations. Preserve credentials and instance identity; do not require operators to remove persistent volumes to apply an update. Test configuration reconciliation and failure paths where relevant.

Run the repository's tests and configured pre-commit checks before opening a pull request. Do not bypass failing checks or commit generated `.env` files, credentials or runtime data.

## Submit a pull request

Use Conventional Commits and keep each change focused. For example, after staging your intended changes:

```bash
git commit -m "fix: improve deployment preflight checks"
git push -u origin fix/deployment-check
```

Open a pull request from your fork to `dev` in the upstream repository. Describe the problem, the change, and the checks you ran. Include relevant migration or compatibility implications. Redact credentials from logs and screenshots.

Keep release management separate from feature work. Do not submit directly to `main` or manually edit the generated changelog.

## Licence

Contributions to `projectdavid-platform` are subject to the repository's licensing terms. See the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). Commercial use requires a separate licence; contact [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk).

## Reference

- [Platform repository](https://github.com/project-david-ai/projectdavid-platform)
- [Project David Core — Contributing](/docs/core-contributing)
- [Platform Overview](/docs/platform-overview)
- [Configuration Reference](/docs/platform-configuration)
- [Upgrading Platform](/docs/platform-upgrading)
