# Validate documentation PRs without publishing an alpha

Use a `docs/` head branch for documentation PRs targeting `builderbot-dev`.
The dev workflow still runs tests, builds packages and checks generated templates, but skips the entire alpha-release job for these PRs, including npm authentication and version changes.
Draft status alone does **not** prevent an alpha release.

## Release policy

| Event | Alpha-release job |
| --- | --- |
| Same-repository PR with head branch `docs/*` | Skipped; validation still runs. |
| Other same-repository PR to `builderbot-dev` | Existing alpha publication behavior is unchanged. |
| Fork PR to `builderbot-dev` | Skipped because fork PRs do not receive repository secrets. |
| Manual `workflow_dispatch` with `dry_run: true` | Existing auth/report-only behavior; no version bump or publish. |
| Manual `workflow_dispatch` with `dry_run: false` | Existing explicit manual release behavior. |

This is a **branch-name rule**, not a file-content detector. `docs/readme` is protected; `feature/docs` and `docs-update` are not.
GitHub's `startsWith` comparison ignores case. The rule does not disable or authorize manual releases.
Keep the `docs/` prefix if a documentation PR is renamed or reconstructed.

## Verify the guard locally

```bash
node --test scripts/tests/dev-release-guard.test.mjs
```

The tests read the actual workflow conditions and cover documentation PRs, non-doc PRs, forks and both manual-dispatch modes without using credentials, modifying package versions or invoking npm publication.
The dev test job runs this command before any release can become eligible.
No npm token or manual workflow dispatch is needed to verify the rule.

## Documentation delivery

The clean dev-based chain replaces the earlier stable-based PRs; it does not import unrelated stable version/test/release commits.
Review the CI guard on the tracker, then integrate its documentation child PRs into that tracker in order. Keep the tracker draft until the children are integrated and combined CI passes.
No merge or npm publication is part of preparing these PRs. Website changes remain separate work in the website repository.
