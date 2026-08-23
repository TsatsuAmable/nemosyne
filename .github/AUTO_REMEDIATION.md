# PR Auto Remediation

`pr-auto-remediation.yml` reacts to two repository events:

- a submitted pull-request review from GitHub Copilot or a trusted repository collaborator;
- a failed run of the `CI` workflow for a same-repository pull request.

The AI process is intentionally sandboxed. It can read/search/edit the checked-out workspace, but it has no shell, network, GitHub mutation, commit, or push tools. Review text, CI logs, and repository content are treated as untrusted data. A deterministic workflow step rejects edits to GitHub workflow/action files and dependency manifests, runs the project verification gate, and only publishes a passing candidate.

## Required repository secrets

The workflow is inert unless both secrets exist.

### `COPILOT_GITHUB_TOKEN`

Create a fine-grained personal access token for the account that owns the Copilot entitlement.

Required permission:

- **Account permission:** Copilot Requests — Read.

Store it as the Actions repository secret `COPILOT_GITHUB_TOKEN`.

This token is exposed only to the Copilot CLI process. The agent is not given shell, network, or GitHub mutation tools.

### `AUTOREMEDIATE_PUSH_TOKEN`

Create a separate fine-grained personal access token scoped only to `TsatsuAmable/nemosyne`.

Required repository permission:

- **Contents:** Read and write.

Store it as the Actions repository secret `AUTOREMEDIATE_PUSH_TOKEN`.

Do not add Actions, Administration, Secrets, or Pull Requests permissions to this token. It is only exposed to the deterministic `git push` step after local verification succeeds.

## Safety boundaries

Automatic remediation never runs for fork pull requests. It will not automatically modify:

- `.github/workflows/**` or `.github/actions/**`;
- dependency manifests or lockfiles;
- secret/authentication handling;
- deployment/release configuration;
- branch or ruleset policy.

Those changes are escalated for human handling.

Review remediation is capped at two consecutive `[auto-review-fix]` commits. CI remediation makes at most one `[auto-ci-fix]` attempt for a failing head commit. These limits prevent infinite review/fix and CI/fix loops.

A verified automated push uses the dedicated push token, so GitHub treats it as a normal user-authenticated branch update. Existing pull-request CI and automatic Copilot re-review rules can therefore run on the new head commit.
