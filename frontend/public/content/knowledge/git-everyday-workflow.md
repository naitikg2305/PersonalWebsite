---
title: "My Everyday Git Workflow: Clone, Branch, Commit, Rebase, Merge, Stash, Worktrees"
category: "Git & GitHub"
slug: "git-everyday-workflow"
summary: "The Git commands I use every day, from cloning and branching to rebasing, comparing branches, stashing, and using worktrees, plus the habits that keep me from running commands in the wrong repo."
---

# My Everyday Git Workflow

## What and why

Git is a version-control system: it records snapshots of a project (commits) and lets you work on branches in parallel and combine them later. GitHub hosts Git repositories and adds pull requests, reviews, and CI. I use maybe twenty Git commands for 95% of my work. This article is the set I actually reach for, in the order I usually use them, plus the safety habits I picked up along the way.

## Mental model in one paragraph

A commit is a snapshot plus a pointer to its parent(s). A **branch** is just a movable label pointing at a commit. `HEAD` is "where I am right now". `origin/main` is your local copy of what the remote's `main` looked like the last time you fetched. Most confusion goes away once you remember that `git fetch` only updates those `origin/*` labels. It never touches your files.

## Getting a repo

```bash
git clone git@github.com:naitikg2305/PersonalWebsite.git   # clone over SSH
git clone git@github-personal:naitikg2305/PersonalWebsite.git  # same, via an SSH host alias (see my SSH article)
```

Starting from a local folder instead:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin main      # -u sets upstream so later `git push` / `git pull` just work
```

**Gotcha I hit:** if you create the GitHub repo *with* a README, the remote already has a commit your local repo doesn't. `git push` is rejected, and `git pull` complains about "unrelated histories". The fix is:

```bash
git pull origin main --allow-unrelated-histories   # merge the two independent histories
# resolve the conflict (usually README.md), then:
git add README.md && git commit
git push --set-upstream origin main
```

The easier fix is to create the GitHub repo empty when you already have local code.

## The daily loop

```bash
git status                       # what changed, what is staged, what branch am I on
git switch main && git pull      # start from an up-to-date main
git switch -c feature/chat-ui    # new branch (older form: git checkout -b)
# ...edit...
git diff                         # unstaged changes
git add -p                       # stage hunk by hunk, so I review my own diff
git diff --staged                # what I'm about to commit
git commit -m "Add chat input component"
git push -u origin feature/chat-ui
```

`git add -p` is the habit that pays off most. It forces me to read every change before committing, and it keeps stray debug prints out.

## Comparing branches

These answer "how different is my branch from main?" without switching branches:

```bash
git fetch origin main
git diff main --stat             # files changed + line counts
git diff main                    # full patch
git diff main -- src/api/        # only one path
git log main..HEAD --oneline     # commits on my branch that aren't on main
git log --oneline --graph --all  # the whole picture
```

`A..B` means "commits reachable from B but not from A". So `main..HEAD` is "what I'd be adding".

## Rebase vs merge

Both integrate changes from one branch into another.

- **Merge** (`git merge main`) creates a merge commit joining the two histories. It is safe and non-destructive, but noisy.
- **Rebase** (`git rebase main`) replays my commits on top of the latest `main`. The result is a linear history, but it rewrites my commits (new hashes).

```bash
git fetch origin
git rebase origin/main           # bring my feature branch up to date
# on conflict: fix files, then
git add <file> && git rebase --continue
git rebase --abort               # bail out, back to where I started
git push --force-with-lease      # needed after rebasing an already-pushed branch
```

**Rule:** rebase your own branches freely. Never rebase a branch other people have built on. Always use `--force-with-lease` instead of `--force`: it refuses to overwrite the remote if someone else pushed in the meantime.

Interactive rebase cleans up a branch before review (squash "fix typo" commits, reword messages):

```bash
git rebase -i origin/main
```

Configure `pull` once so it doesn't ask every time:

```bash
git config --global pull.rebase true    # or false to merge; I prefer rebase for feature work
```

## Rebase-and-merge PRs

Many repos I work in use GitHub's **"Rebase and merge"** button. It replays each PR commit onto `main` with no merge commit. What that means in practice:

- Each commit lands on `main` as-is, so **every commit should be meaningful and should build**. Squash the WIP commits locally first.
- Commit hashes on `main` differ from the ones on your branch. After merge, delete the branch and don't keep working on it.
- If `main` moved, rebase locally (`git rebase origin/main`), push with `--force-with-lease`, and let CI rerun before merging.

The alternatives are **Squash and merge** (the whole PR becomes one commit) and **Create a merge commit**.

## Stash: park work temporarily

```bash
git stash push -m "half-done refactor"   # save tracked changes and clean the tree
git stash push -u -m "incl. new files"   # -u also stashes untracked files
git stash list
git stash pop                            # reapply the latest and drop it
git stash apply stash@{1}                # reapply without dropping
```

I use stash when I need to switch branches quickly. For anything longer than a few minutes, a worktree or a WIP commit is safer, because stashes are easy to forget.

## Cherry-pick: copy one commit

```bash
git cherry-pick <sha>          # apply that commit on top of the current branch
git cherry-pick -x <sha>       # adds "(cherry picked from ...)" to the message
git cherry-pick --abort
```

This is useful for pulling a hotfix onto a release branch without merging everything else.

## Worktrees: several branches checked out at once

A worktree is a second working directory attached to the same repository. There's no re-clone and no stashing.

```bash
git worktree add ../myrepo-hotfix -b hotfix/login origin/main
git worktree list
git worktree remove ../myrepo-hotfix
git worktree prune              # clean up entries for deleted folders
```

I use worktrees to review a PR while my own branch stays untouched, to run two branches side by side, and to give an AI coding agent its own isolated checkout. A branch can only be checked out in one worktree at a time.

### Dry-running a merge in a throwaway worktree

Before a risky merge or rebase, I rehearse it somewhere disposable:

```bash
git fetch origin
git worktree add --detach /tmp/merge-test origin/main
git -C /tmp/merge-test merge --no-commit --no-ff origin/feature/big-change
git -C /tmp/merge-test diff --name-only --diff-filter=U   # list conflicting files
git -C /tmp/merge-test merge --abort
git worktree remove --force /tmp/merge-test
```

My real working tree never changes, so I know exactly which files will conflict before I commit to anything. Newer Git versions can also do `git merge-tree --write-tree origin/main origin/feature/big-change` to check for conflicts without any checkout at all.

## Safety habit: `git -C <path>`

`git -C <path> <command>` runs Git as if you were in `<path>`. I use it constantly, especially in scripts and when driving tools from another directory:

```bash
git -C ~/code/personal/PersonalWebsite status
git -C ~/code/personal/PersonalWebsite log --oneline -5
```

It removes the classic mistake of `cd`-ing somewhere, forgetting, and committing or resetting in the wrong repository. Before anything destructive, I also run `git -C <path> remote -v` and `git -C <path> branch --show-current` to confirm I'm where I think I am.

## Key takeaways

- `fetch` updates `origin/*` only. `pull` is fetch plus merge/rebase.
- Stage with `git add -p` and review `git diff --staged` before every commit.
- `git diff main --stat` and `git log main..HEAD` tell you how your branch differs.
- Rebase your own branches. Push with `--force-with-lease`, never plain `--force`.
- With rebase-and-merge PRs, every commit lands on main, so tidy them first.
- Worktrees beat stash for anything non-trivial, and they make a safe sandbox for dry-run merges.
- Use `git -C <path>` and check `remote -v` before destructive commands.
