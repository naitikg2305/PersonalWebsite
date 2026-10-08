---
title: "SSH Keys and Multiple GitHub Accounts on One Machine"
category: "Git & GitHub"
slug: "git-ssh-multiple-github-accounts"
summary: "How to create SSH keys, add them to GitHub, and use ~/.ssh/config host aliases so personal and work GitHub accounts coexist on one machine without pushing as the wrong identity."
---

# SSH Keys and Multiple GitHub Accounts on One Machine

## What and why

GitHub authenticates Git-over-SSH by your **key**, not by a username. Each public key can be attached to only one GitHub account. So if you have a personal account and one or more work accounts, you need one key per account and a way to tell SSH which key to use for which repo.

The trick is **host aliases** in `~/.ssh/config`. I set this up on a fresh Arch Linux install with a personal identity and separate work identities, and it has been painless since.

## Step 1: make sure OpenSSH is installed

On a minimal Arch install, `ssh-keygen` wasn't even present:

```bash
sudo pacman -S openssh        # Debian/Ubuntu: sudo apt install openssh-client
mkdir -p ~/.ssh
chmod 700 ~/.ssh              # SSH refuses keys in group/world-readable dirs
```

## Step 2: one key per account

```bash
ssh-keygen -t ed25519 -C "you@example.com"      -f ~/.ssh/id_ed25519_personal
ssh-keygen -t ed25519 -C "you@work.example.com" -f ~/.ssh/id_ed25519_work
```

- `-t ed25519` is the modern, short, fast key type. Use it unless something forces RSA.
- `-C` is just a comment label. It doesn't affect authentication.
- `-f` names the file, which matters once you have more than one key.
- Set a passphrase. The agent (below) means you'll rarely type it.

Each command creates two files: `id_ed25519_work` (the **private key**, which never leaves your machine) and `id_ed25519_work.pub` (the **public key**, safe to share).

## Step 3: add the public keys to GitHub

```bash
cat ~/.ssh/id_ed25519_personal.pub
```

Copy the whole line, from `ssh-ed25519` to the comment. Then go to **GitHub -> Settings -> SSH and GPG keys -> New SSH key** while logged into the matching account. Repeat for each account.

If a work organization uses SAML SSO, you may also need to click **Configure SSO -> Authorize** next to the key.

## Step 4: load keys into the agent

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519_personal
ssh-add ~/.ssh/id_ed25519_work
ssh-add -l                    # list loaded keys
```

On macOS, add `UseKeychain yes` / `AddKeysToAgent yes` in the config. On Linux desktops, the keyring (GNOME Keyring, KWallet) often handles this for you.

## Step 5: host aliases in `~/.ssh/config`

```sshconfig
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes

Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes
```

```bash
chmod 600 ~/.ssh/config
```

How it works:

- `Host github-work` is a made-up name. Whenever SSH sees that "host", it applies this block.
- `HostName github.com` is where it actually connects.
- `IdentityFile` is which key to offer.
- `IdentitiesOnly yes` is **the important line**. Without it, SSH offers *every* key in the agent. GitHub accepts the first one that belongs to *any* account, and you end up authenticated as the wrong user, with confusing "repository not found" errors.

## Step 6: test each identity

```bash
ssh -T git@github-personal
# Hi naitikg2305! You've successfully authenticated, but GitHub does not provide shell access.
ssh -T git@github-work
# Hi <work-username>! ...
```

The greeting tells you exactly which account a key maps to. This is the first thing to check whenever a push fails.

## Step 7: clone and set remotes with the alias

Replace `github.com` in the SSH URL with your alias:

```bash
git clone git@github-personal:naitikg2305/PersonalWebsite.git
git clone git@github-work:SOME_ORG/SOME_REPO.git
```

For an existing repo that was cloned with the plain URL:

```bash
git remote -v
git remote set-url origin git@github-work:SOME_ORG/SOME_REPO.git
```

For a one-off with no config change:

```bash
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519_personal -o IdentitiesOnly=yes' \
  git clone git@github.com:USERNAME/REPO.git
```

Or pin it per repo: `git config core.sshCommand "ssh -i ~/.ssh/id_ed25519_work -o IdentitiesOnly=yes"`.

## Step 8: don't forget commit identity

This trips people up constantly. Three separate things are in play:

```text
SSH key        -> which GitHub account is allowed to push
user.email     -> which account the commits are attributed to
user.name      -> the display name on commits
```

You can push with your work key and still author commits with your personal email, or the reverse. So set the identity per repo, or per folder with `includeIf`:

```bash
git -C ~/code/work/some-repo config user.email "you@work.example.com"
```

```ini
# ~/.gitconfig
[includeIf "gitdir:~/code/work/"]
    path = ~/.gitconfig-work
```

I keep repos organized by identity (`~/code/personal/`, `~/code/work-a/`, `~/code/work-b/`), which makes the folder-based `includeIf` rule trivial. It also makes it obvious from the path which account a repo belongs to.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Permission denied (publickey)` | Key not added to GitHub, not loaded in the agent, or wrong file permissions |
| `ERROR: Repository not found` on a repo you can see in the browser | Authenticated as the *other* account. Check with `ssh -T` and add `IdentitiesOnly yes` |
| Push works but the commit shows the wrong avatar | `user.email` is wrong for this repo |
| Works for personal, fails for an org | SSO authorization missing on the key |

Debug with verbose SSH to see which keys are offered:

```bash
ssh -vT git@github-work 2>&1 | grep -i "offering\|authenticated"
```

## Security notes

- Never paste, commit, or share the private key file (the one **without** `.pub`).
- Keep `~/.ssh` at `700` and private keys at `600`.
- Use a passphrase, and remove keys from GitHub when you retire a machine.
- If a private key might be exposed, delete it from GitHub immediately and generate a new one.

## Key takeaways

- One SSH key per GitHub account. A key can belong to only one account.
- `~/.ssh/config` host aliases (`github-personal`, `github-work`) choose the key, and `IdentitiesOnly yes` is essential.
- Use the alias in clone URLs, or switch existing remotes with `git remote set-url`.
- `ssh -T git@<alias>` tells you which account you are.
- The SSH key decides who can push. `user.email` decides who authored the commit. Configure both.
