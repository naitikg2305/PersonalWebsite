---
title: "Fixing Git Mistakes: Reset, Revert, Restore, Amend, and the Reflog"
category: "Git & GitHub"
slug: "git-fixing-mistakes"
summary: "How to undo almost anything in Git (bad commits, wrong branch, wrong author, lost work) and how to choose between reset, revert, restore, and amend safely."
---

# Fixing Git Mistakes

## What and why

Almost nothing in Git is truly lost once it has been committed. The hard part is picking the right undo tool. The one question that decides it is: **has this already been pushed and shared?**

- **Not pushed:** you can rewrite history freely (`reset`, `amend`, interactive rebase).
- **Pushed to a shared branch:** don't rewrite. Add a new commit that undoes it (`revert`).

## Cheat sheet

| Situation | Command |
|---|---|
| Discard unstaged edits to a file | `git restore <file>` |
| Unstage a file (keep the edits) | `git restore --staged <file>` |
| Fix the last commit's message or add a forgotten file | `git commit --amend` |
| Undo the last commit, keep the changes staged | `git reset --soft HEAD~1` |
| Undo the last commit, keep the changes unstaged | `git reset HEAD~1` (mixed, the default) |
| Throw away the last commit and its changes | `git reset --hard HEAD~1` |
| Undo a pushed commit safely | `git revert <sha>` |
| Recover "lost" commits | `git reflog`, then `git reset --hard <sha>` or `git branch rescue <sha>` |
| Abort an in-progress merge/rebase/cherry-pick | `git merge --abort` / `git rebase --abort` / `git cherry-pick --abort` |

## The three flavours of reset

`git reset <target>` moves the current branch label to `<target>`. The flag decides what happens to your files:

```bash
git reset --soft HEAD~1   # move branch; changes stay STAGED
git reset --mixed HEAD~1  # move branch; changes stay in working tree, unstaged (default)
git reset --hard HEAD~1   # move branch; working tree and index overwritten. Changes gone
```

`--hard` is the only destructive one. Uncommitted work it wipes is **not** in the reflog. Before using it, I run `git status` and `git stash` anything I might want back.

## Amend: fix the last commit

```bash
git add forgotten_file.py
git commit --amend --no-edit      # add to last commit, keep message
git commit --amend -m "Better message"
```

Amend creates a new commit with a new hash. If you already pushed, you'll need `git push --force-with-lease`. Only do that on your own branch.

## Revert: undo without rewriting history

```bash
git revert <sha>                 # new commit that inverts <sha>
git revert <sha1>..<sha2>        # a range
git revert -m 1 <merge-sha>      # revert a merge commit, keeping parent 1 (the mainline)
```

This is the right tool for `main` or any shared branch, because everyone's history stays consistent.

## Common "oops" scenarios

### I committed to `main` instead of a feature branch (not pushed)

```bash
git branch feature/my-work        # new label at the current commit
git reset --hard origin/main      # move main back to the remote state
git switch feature/my-work        # your commits are here
```

### I committed to the wrong feature branch

```bash
git switch correct-branch
git cherry-pick <sha>
git switch wrong-branch
git reset --hard HEAD~1           # if not pushed
```

### I committed with the wrong author email

This one bit me for real (see the identity section below). To fix the last commit:

```bash
git config user.email "you@example.com"          # fix the config first
git commit --amend --reset-author --no-edit
```

For several recent commits:

```bash
git rebase -i HEAD~5 --exec "git commit --amend --reset-author --no-edit"
```

Then run `git push --force-with-lease` if they were already pushed to your own branch. If the commits are already on a shared `main`, it's usually better to leave them and just fix the config for future commits. If the only thing you need is a redeploy under the right author, an empty commit does it:

```bash
git commit --allow-empty -m "Trigger build with correct author"
```

### I ran `reset --hard` or a rebase went wrong

The **reflog** records every position `HEAD` has been at, locally, for about 90 days by default:

```bash
git reflog                        # find the entry before the mistake, e.g. HEAD@{3}
git reset --hard HEAD@{3}         # jump back
# or, more cautiously:
git branch rescue HEAD@{3}
```

This is why committed work is almost never lost. Commit early, even as WIP, because a commit is recoverable and an uncommitted edit is not.

### I deleted a branch

```bash
git reflog | grep feature/old     # or look for its last commit message
git branch feature/old <sha>
```

### The remote has commits I don't have, so my push is rejected

```bash
git pull --rebase origin main     # replay my commits on top of the remote's
git push
```

Don't reach for `--force` here. That would delete someone else's work.

### I accidentally committed a secret

Treat the secret as compromised **immediately**: rotate or revoke it first. Rewriting history comes second, because the secret may already have been cloned, cached, or scraped. Then remove it from history with `git filter-repo` (or BFG) and force-push. On GitHub, also enable push protection and secret scanning so it doesn't happen again.

### A file should never have been tracked

```bash
echo ".env" >> .gitignore
git rm --cached .env              # stop tracking, keep the local file
git commit -m "Stop tracking .env"
```

`.gitignore` only affects untracked files, so a file Git already tracks has to be removed from the index explicitly.

## Commit identity per repo

Git stamps every commit with `user.name` and `user.email`. These are **separate** from the SSH key you push with. The key decides which GitHub account is allowed to push. The email decides who the commit is *attributed to*.

The lesson I learned the hard way: early commits to my personal website were authored with my school Git identity. Vercel's Hobby plan **blocks deployments when the commit author isn't the account owner's GitHub identity**, so pushes silently stopped deploying. The fix was an empty commit with the correct author, and setting the email **per repo**:

```bash
git config user.email               # check, inside the repo, before pushing
git config user.email "you@example.com"     # repo-local (.git/config)
git config --global user.email "you@example.com"  # default for all repos
```

To make this automatic, I use conditional includes so every repo under a folder gets the right identity:

```ini
# ~/.gitconfig
[user]
    name = Naitik Gupta
    email = personal@example.com
[includeIf "gitdir:~/code/work/"]
    path = ~/.gitconfig-work
```

```ini
# ~/.gitconfig-work
[user]
    email = you@work.example.com
```

Check where a value comes from with `git config --show-origin user.email`.

## Gotchas

- `git checkout <file>` and `git restore <file>` discard edits with **no undo**.
- `reset --hard` and `clean -fd` delete uncommitted and untracked work permanently. Dry-run `git clean -n` first.
- The reflog is local. It won't help on a fresh clone.
- After any history rewrite, use `--force-with-lease`, and tell collaborators.

## Key takeaways

- Pushed and shared means `revert`. Local only means `reset`, `amend`, or rebase.
- `reset --soft` / `--mixed` keep your changes. `--hard` doesn't.
- `git reflog` rescues nearly every committed mistake, so commit often.
- Wrong author? Fix `user.email` per repo and amend with `--reset-author`. Platforms like Vercel care.
- Leaked secret: rotate first, rewrite history second.
