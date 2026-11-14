# Contributing to LunarSight

Before proposing a change, read the project overview and boundaries in [README.md](README.md) and the [repository guide](docs/repository-guide.md).

## Safe contribution workflow

1. Start from the current default branch and create a separate, descriptively named branch for your work. Do not work directly on the default branch.
2. Check the existing open changes and coordinate before editing shared or integration-sensitive files. In particular, coordinate changes to API contracts, shared data, build/deployment configuration, and common frontend/backend interfaces.
3. Keep the change focused on the agreed scope. Do not enter another contributor's or agent's scope without asking and coordinating first.
4. Run the relevant checks below. Report exactly what you ran and whether it passed; do not describe unrun checks as passing.
5. Open a pull request for review. Do not push directly to the default branch or bypass review.

Never commit credentials, API keys, tokens, private keys, `.env` files containing secrets, or other sensitive data. Use the checked-in `.env.example` files as templates and provide secrets only through your local environment or approved secret storage. Inspect the staged diff before committing.

## Tests and checks

Run commands from the repository root unless noted. These commands are based on the currently declared development requirements and package scripts.

### Backend

Create and activate a virtual environment, then install the declared development dependencies:

```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell instead: .\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements-dev.txt
python -m pytest backend/tests -q
```

The development requirements pin `httpx==0.27.2`, `pytest==8.3.5`, and `pytest-subtests==0.14.2`; keep the `httpx` compatibility constraint in mind when changing test dependencies.

### Frontend

```bash
cd frontend
npm install
npm test -- --watchAll=false
npm run build
```

`npm test` invokes the Create React App test runner in watch mode by default; `-- --watchAll=false` makes it suitable for a one-shot test run. The available scripts in `frontend/package.json` are `start`, `build`, `test`, and `eject`; there is no declared lint or typecheck script. Do not report a standalone lint/typecheck as a project-provided command unless one is added and verified.

### Independent ephemeris module

`src/features/ephemeris/package.json` defines no npm scripts. Its tests run separately from the frontend. From the repository root, with a Node version supporting native TypeScript stripping:

```bash
node --experimental-strip-types --test src/features/ephemeris/tests/*.test.ts
```

See the [module's reproduction instructions](src/features/ephemeris/README.md#reproduce-checks) for reference checks and tool prerequisites. Frontend tests/builds do not validate this independent engine.

### Reporting results

In your pull request, list the exact commands run, their outcomes, and any checks you did not run (with a brief reason). A command that was not run is **not** a passing check. If a check fails, include the relevant failure and whether it is related to your change.

## Scientific and data boundaries

Preserve explicit distinctions between measured/source data, modeled or derived values, and synthetic or illustrative data. Do not present synthetic or generated values as observations, measured terrain, validated predictions, or mission-qualified outputs. Retain source citations, attribution, licensing terms, and any integrity metadata when modifying data assets; a hash verifies artifact identity, not scientific provenance or correctness.

Respect the supported data and model limits documented in [README.md](README.md): the backend uses bundled precomputed data for the supported catalog, with hourly native series and interpolation between samples. Do not imply that interpolation is a new ephemeris calculation or validates sub-hour events. The separate terrain visualization does not redefine backend skyline/ephemeris coverage. Do not claim arbitrary-coordinate or live-network ephemeris support where it does not exist.

Keep coordinate frames and model assumptions explicit. Mapping field names or adapting transport does not perform a coordinate-frame transformation. Do not silently combine, relabel, or treat independent engines or frame assumptions as interchangeable. If frame metadata is unverified, preserve that uncertainty and the documented rejection/compatibility boundaries rather than claiming validation.

## Contributor attribution and team information

GitHub's contributor attribution is generated from commits reachable on the repository's default branch and from the email address associated with each commit. Follow GitHub's normal attribution behavior; do not manufacture empty or fake commits, rewrite history to create attribution, or attribute work to someone else without their explicit authorization. Do not put another person's name or identity on a commit that they did not author.

If you want GitHub to associate your commits with your account while keeping your personal email private, configure and verify the GitHub-provided noreply email in your own GitHub email settings, then configure Git locally as appropriate. This guide intentionally does not publish or guess anyone's personal or noreply email address.

The README's **Team** information and GitHub's automatic **Contributors** attribution serve different purposes. Do not alter team membership or present contributor attribution as a replacement for the README's team information; changes to team details should be coordinated with the maintainers.
