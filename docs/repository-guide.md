# Repository guide

This is a map of the repository as inspected on 2026-11-14, not a prescription to reorganize it. Keep existing paths intact: this guide proposes no file moves or deletions. Team notes under `docs/team/` are historical working records; they may describe proposals, earlier states, or work that is not part of the current runtime. Do not read every note as a current project claim.

## Top-level layout

| Path | Role |
| --- | --- |
| [`frontend/`](../frontend/) | React + TypeScript user interface, static assets, and API client. |
| [`backend/`](../backend/) | FastAPI application, local-data services, and backend tests. |
| [`data/lunanav/`](../data/lunanav/) | Bundled runtime reference and science data, including its manifest. |
| [`src/features/ephemeris/`](../src/features/ephemeris/) | Separate TypeScript ephemeris engine and supporting tools/tests; not currently wired into the root application. |
| [`docs/`](./) | Data-bundle documentation, design material, and dated/team working notes. |
| [`scripts/`](../scripts/) | Repository utilities, including reference-data packaging. |
| [`README.md`](../README.md) | User-facing overview, quick start, deployment, and limitations. |
| [`Rehber.txt`](../Rehber.txt), [`start.bat`](../start.bat) | Existing root-level guidance and Windows launcher. |

## Current runtime path

The shipped application path is **React frontend → FastAPI backend → local `data/lunanav` artifacts**. The frontend calls the backend API; the backend reads bundled precomputed reference data. See [backend setup and API](../backend/README.md), [bundle contents and paths](./data-bundle.md), and [the root overview](../README.md).

The backend's `/api/ephemeris` is a local-data facade, not the former network engine: supported sites and coverage are bounded by the bundle. The frontend terrain mesh is a separate display asset and does not recalculate backend skylines or add ephemeris sites. Contracts endpoints are an opt-in mapping adapter and are not called by the current frontend. These limits are runtime boundaries, not reasons to merge engine code or relocate data.

## Independent ephemeris module

[`src/features/ephemeris/`](../src/features/ephemeris/) is a distinct, offline TypeScript engine with its own vector dataset, coordinate and frame assumptions, scenario validation, and computation policy. Its README explicitly says the root application is not wired to it. It is not the FastAPI runtime, does not control it, and must not be presented as an interchangeable backend or an integrated third engine. Any future connection needs explicit interface, frame, provenance, and validation work; this guide does not prescribe that integration.

## Reading integration notes and branch state

[`docs/team/`](./team/) contains collaboration/audit notes accumulated during development. Treat them as historical evidence with their own dates and context, not as a single authoritative current-state spec. Confirm implementation in the runtime documentation and code before relying on a note. In particular, do not present other agents' branches or work as merged or integrated based only on these notes.

At the time of this guide's inspection, this worktree was on `docs/team-and-repository-guide` and tracked `origin/feat/app-integration`; the visible upstream/default baseline was therefore `feat/app-integration`. This is an **audit snapshot**, not a permanent claim about the repository's default branch. Check the repository's current hosting configuration and branch state before making branch or merge decisions. Do not infer that parallel work is integrated, or recommend automatic merging or deletion of branches.

## Safe contribution rule

Prefer adding or correcting a focused document over reorganizing this repository. Preserve existing runtime paths and data unless a separately reviewed implementation task explicitly calls for a change. Keep claims scoped to the observed implementation; distinguish precomputed/interpolated data, independent engines, historical notes, and future integration work.
