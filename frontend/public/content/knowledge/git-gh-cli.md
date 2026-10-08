---
title: "The GitHub CLI (gh): Auth, Pull Requests, gh api, and Switching Accounts"
category: "Git & GitHub"
slug: "git-gh-cli"
summary: "How I use the GitHub CLI to authenticate, open and merge pull requests, query the GitHub REST API with gh api and --jq, and switch between multiple GitHub accounts."
---

# The GitHub CLI (`gh`)

## What and why

`git` talks to repositories. `gh` talks to **GitHub the platform**: pull requests, issues, CI runs, releases, deployments, and the full REST/GraphQL API. I use it to stay in the terminal instead of clicking through the web UI. It's also great for answering questions like "did my last push actually deploy?" with a single command.

Install it with `sudo pacman -S github-cli` on Arch, `brew install gh` on macOS, or see cli.github.com.

## Authentication

```bash
gh auth login                 # interactive: GitHub.com, SSH or HTTPS, browser login
gh auth status                # which account(s) are logged in, active account, token scopes
gh auth refresh -s admin:repo_hook   # add a scope to the existing token
gh auth setup-git             # let git use gh as a credential helper for HTTPS remotes
```

Some API endpoints need extra scopes. Listing a repo's webhooks, for example, fails until you `gh auth refresh -s admin:repo_hook`. The error message usually tells you which scope is missing.

## Multiple accounts

`gh` supports several logged-in accounts on the same host:

```bash
gh auth login                       # run once per account
gh auth status                      # shows all, marks the active one
gh auth switch                      # interactive toggle
gh auth switch --user naitikg2305   # switch to a specific account
```

Things to know:

- `gh` uses the **active account** for everything, regardless of which repo you're in. That's different from the SSH-alias setup, where the remote URL picks the identity. Before creating a PR in a work repo, run `gh auth status`.
- For a one-off command as another account without switching, set a token for that process: `GH_TOKEN=$(gh auth token --user other-account) gh pr list`.
- `gh` infers the repo from the current directory's `origin`. Host aliases like `github-work` in the remote URL generally resolve fine, but you can always be explicit with `-R owner/repo`.

## Pull requests

```bash
gh pr create --fill                       # title/body from commits
gh pr create -t "Add chat UI" -b "Details..." --base main --draft
gh pr list                                # open PRs in this repo
gh pr status                              # PRs relevant to me
gh pr view 42 --web                       # open in browser
gh pr checkout 42                         # check out someone's PR locally
gh pr diff 42
gh pr checks 42 --watch                   # wait for CI
gh pr review 42 --approve                 # or --request-changes -b "..."
gh pr merge 42 --rebase --delete-branch   # rebase-and-merge, then delete branch
```

`gh pr merge` supports `--merge`, `--squash`, and `--rebase`, matching the three buttons on GitHub. Many of my repos use rebase-and-merge, so my flow is:

```bash
git fetch origin && git rebase origin/main     # make sure the branch is current
git push --force-with-lease
gh pr checks --watch                           # wait for green
gh pr merge --rebase --delete-branch
```

`gh pr merge --auto --rebase` queues the merge to happen once required checks pass.

Combining `gh pr checkout` with a worktree lets me review a PR without disturbing my current branch:

```bash
git worktree add ../review-42 && cd ../review-42 && gh pr checkout 42
```

## Other everyday commands

```bash
gh repo clone naitikg2305/PersonalWebsite
gh repo create my-new-repo --private --source=. --push   # create from the current folder
gh repo view --web
gh issue list / gh issue create / gh issue view 7
gh run list                     # GitHub Actions runs
gh run view --log-failed        # logs of only the failing steps
gh run watch
gh release create v1.0.0 --generate-notes
gh browse                       # open the repo in a browser
```

## `gh api`: the escape hatch

`gh api` calls any GitHub REST endpoint with your auth already attached. `{owner}` and `{repo}` are filled in from the current repo, and `--jq` filters the JSON output without needing `jq` installed.

```bash
gh api user --jq .login                                   # who am I?
gh api repos/{owner}/{repo} --jq '.default_branch'
gh api repos/{owner}/{repo}/pulls --jq '.[] | [.number, .title] | @tsv'
gh api --paginate repos/{owner}/{repo}/commits --jq '.[].sha' | wc -l
gh api -X POST repos/{owner}/{repo}/issues -f title="Bug" -f body="Steps..."
gh api graphql -f query='query { viewer { login } }'
```

`-f` sends string fields, `-F` sends typed fields (numbers, booleans, `@file`), `-X` sets the method, and `--paginate` follows all pages.

### Real example: debugging deploys on my portfolio

My site deploys on Vercel through its GitHub integration, which reports back to GitHub as deployments and commit statuses. When a push didn't seem to deploy, these answered it without opening any dashboard:

```bash
R=naitikg2305/PersonalWebsite
gh api repos/$R/deployments --jq '.[] | [.environment, .ref[0:7], .created_at] | @tsv'   # deploy history
gh api repos/$R/commits/main/statuses --jq '.[] | [.context, .state, .description] | @tsv'  # did the last push deploy?
gh api repos/$R/environments --jq '.environments[].name'   # revealed duplicate Vercel projects
gh api repos/$R/hooks                                      # needs: gh auth refresh -s admin:repo_hook
```

The environments query showed that several duplicate Vercel projects were connected to the same repo, so every push was being built several times. That's something I would never have noticed from the git side.

## Gotchas

- **Wrong active account.** PRs and comments get created as whoever is active in `gh`, not whoever owns the SSH key. Check `gh auth status`.
- **Scopes.** A 404 or 403 from `gh api` on something you can see in the browser is often a missing token scope or org SSO authorization, not a missing resource.
- **Org SSO.** For organizations with SAML SSO, the token must be authorized for that org (GitHub prompts with a URL).
- **Tokens are secrets.** `gh auth token` prints your token. Never paste its output anywhere public or into a file in a repo.
- **Rate limits.** `gh api rate_limit` shows what's left. Be gentle with `--paginate` on big repos.

## Key takeaways

- `gh auth login`/`status`/`switch` manage one or many accounts. The active account is what `gh` acts as.
- `gh pr create --fill`, `gh pr checks --watch`, and `gh pr merge --rebase --delete-branch` cover most of a PR lifecycle.
- `gh api` with `--jq` turns the whole GitHub API into one-liners, which is great for debugging CI and deploy integrations.
- Add token scopes as needed with `gh auth refresh -s <scope>`.
- Treat `gh auth token` output like a password.
