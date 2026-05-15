---
name: fork-sync
description: 'Inspect and synchronize a fork with iOfficeAI/AionUi. Use for upstream sync, origin/upstream remote verification, ahead-behind checks, merge-base review, rebase-vs-merge decisions, fork drift analysis, and safe sync execution planning.'
argument-hint: 'Describe whether you want a read-only sync report, a merge/rebase recommendation, or actual sync execution.'
user-invocable: true
---

# Fork Sync

Use this skill when the task is about keeping the cubecloud fork aligned with upstream `iOfficeAI/AionUi`.

## When to Use

- Verify `origin` and `upstream` remotes before sync work
- Compare fork drift against `upstream/main`
- Decide whether to fast-forward, merge, or rebase
- Prepare a safe sync PR for the fork
- Review rebrand commits that may conflict with upstream changes

## Current Repo Reality

- In the current workspace, `origin` points to a fork and `upstream` points to `https://github.com/iOfficeAI/AionUi.git`.
- Treat that as a working convention, not a guarantee. Re-check remotes each time before issuing sync commands.
- Load [cubecloud fork maintenance](../../instructions/cubecloud-fork.instructions.md) before changing branding, licensing, release, or registry surfaces during a sync.

## Procedure

1. Verify remotes and branch state first.
   - Run `git remote -v`.
   - Run `git branch --show-current`.
   - Run `git status --short`.
   - If `upstream` is missing or points somewhere unexpected, stop and ask before rewriting remotes.

2. Fetch both remotes and tags without changing history.
   - Run `git fetch --prune origin`.
   - Run `git fetch --prune upstream --tags`.

3. Measure divergence before proposing a sync path.
   - Run `git rev-list --left-right --count HEAD...upstream/main`.
   - Run `git log --oneline --decorate --graph HEAD..upstream/main` for incoming upstream commits.
   - Run `git log --oneline --decorate --graph upstream/main..HEAD` for fork-only commits.
   - Run `git diff --stat --find-renames upstream/main...HEAD` to estimate the conflict surface.

4. Choose the least risky sync strategy.
   - Prefer `git merge --ff-only upstream/main` when the current branch has no fork-only commits.
   - Prefer a normal merge from `upstream/main` when the fork branch already has published or shared commits.
   - Use rebase only when the branch is private or the user explicitly wants rewritten history.
   - Never force-push `main` or rewrite published tags unless the user explicitly asks.

5. Keep fork-specific work isolated during conflict resolution.
   - Preserve Apache-2.0 files and attribution.
   - Keep cubecloud-specific branding, GHCR, download URLs, and registry changes as small overlay edits.
   - Avoid broad search-and-replace during a sync branch.

6. Validate after sync work.
   - Start with the narrowest checks for touched files.
   - For broader syncs, use the repo defaults from [AGENTS.md](../../../AGENTS.md): `bun run lint:fix`, `bun run format`, `bunx tsc --noEmit`, and targeted tests before pushing.

7. Prefer a sync PR when the delta is non-trivial.
   - Create a dedicated sync branch from the fork.
   - Merge `upstream/main` into that branch.
   - Resolve conflicts, validate, and open a PR into fork `main`.
   - Summarize which conflicts were pure upstream adoption versus cubecloud-specific overrides.

## Decision Rules

- If the worktree is dirty and the user asked for actual sync execution, stop and ask how to handle local changes.
- If a sync touches release workflows, installer scripts, Dockerfiles, or brand identity, also load [release channel rules](../../instructions/release-channel.instructions.md).
- If remotes use different names than `origin` and `upstream`, adapt the commands to the actual config instead of renaming them automatically.
