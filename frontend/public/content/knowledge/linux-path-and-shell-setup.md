---
title: "Adding Things to PATH on Linux and WSL (and Checking What Your Shell Will Run)"
category: "Linux: Commands & System Management"
slug: "linux-path-and-shell-setup"
summary: "How PATH works, how to permanently add a directory to it in bash, how to expose a Windows tool like Cursor inside WSL, and how to debug 'command not found'."
---

# PATH and Shell Setup on Linux and WSL

When you type `cursor` or `claude` in a terminal, the shell looks through every directory listed in the `PATH` environment variable, in order, and runs the first matching executable it finds. "Command not found" means none of those directories has it. Running the wrong version usually means an earlier directory has a different copy.

I've hit both problems: on WSL with Windows-installed editors, and on Arch with two installs of the same CLI.

## Inspect PATH and find out what will run

```bash
echo $PATH                     # colon-separated list of directories, searched left to right
echo $PATH | tr ':' '\n'       # one directory per line, easier to read
which cursor                   # first match on PATH
type -a claude                 # every match, plus aliases/functions with that name
command -v node                # portable "is this available?" check (good in scripts)
readlink -f "$(which claude)"  # follow symlinks to the real file
hash -r                        # forget bash's cached command locations after moving things
```

On Windows PowerShell, the equivalents are:

```powershell
where.exe cursor                     # path(s) to the executable
Get-Command cursor | Format-List *   # full details, including the real Path
```

On my Windows machine, Cursor's installer had already added its `bin` folder to the Windows PATH. `Get-Command` showed the real location, something like `C:\Users\YOURNAME\AppData\Local\Programs\cursor\resources\app\bin\cursor.cmd`. When plain `where` didn't work, `Get-Command` did.

## Add a directory to PATH for the current session

```bash
export PATH="$PATH:/opt/mytool/bin"     # append: system versions still win
export PATH="$HOME/.local/bin:$PATH"    # prepend: your versions win
```

This lasts until you close the terminal.

## Make it permanent (bash)

Put the export line at the bottom of `~/.bashrc`. That's the file interactive bash shells read at startup.

```bash
nano ~/.bashrc
```

Add:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Reload it without opening a new terminal:

```bash
source ~/.bashrc
```

Notes:

- **Add the directory, not the file.** PATH entries are folders. Use `.../bin`, not `.../bin/cursor.cmd`.
- **Append or prepend on purpose.** Prepending `~/.local/bin` is how a user-level install of a tool overrides a system one.
- **Quote the value**, especially on WSL, where Windows paths can contain spaces.
- Login shells may read `~/.bash_profile` or `~/.profile` instead. On most desktops, `~/.bashrc` is right for terminals. For zsh, use `~/.zshrc`.
- Don't add `.` (the current directory) to PATH.

## WSL: running a Windows tool from Linux

WSL mounts Windows drives under `/mnt/c/...`. To use Windows-installed Cursor from a WSL bash prompt, I added its Windows `bin` folder to my WSL PATH.

```bash
nano ~/.bashrc
```

At the bottom:

```bash
export PATH="$PATH:/mnt/c/Users/YOURNAME/AppData/Local/Programs/cursor/resources/app/bin"
```

```bash
source ~/.bashrc
cursor .          # opens the current WSL folder in Cursor
```

Lessons from setting that up:

- The path stops at `bin`, not at `cursor.cmd`.
- I **appended** the Windows path, so any Linux-native tool with the same name still wins.
- By default WSL already imports the Windows PATH, so check `which cursor` before adding anything. Adding it by hand is the fix when that import is disabled or the folder is missing.
- The Windows path is case-insensitive, but the `/mnt/c/...` path you type must match the real folder.

## Other environment variables I keep in ~/.bashrc

PATH isn't the only variable worth setting once and forgetting. I point all Hugging Face downloads at one shared model store, so every project's virtual environment reuses the same weights:

```bash
export HF_HOME="$HOME/models/huggingface"
```

Check any variable with:

```bash
echo $HF_HOME
env | grep -i hf
printenv PATH
```

## Real incident: two installs of the same CLI

On Arch I had a CLI installed twice: a user-level copy in `~/.local/bin` and an older root-level copy in `/usr/bin`. `~/.local/bin` comes first on my PATH, so the user copy was the one that ran.

```bash
type -a claude                          # showed both locations, in PATH order
ls -l ~/.local/bin/claude /usr/bin/claude   # both were symlinks to different installs
```

When the user copy broke, fixing that one was enough, because PATH order meant the root copy never ran. The lesson: when a command behaves strangely, run `type -a` before reinstalling. You might be running a different copy than you think.

## Debugging "command not found"

```bash
command -v TOOL || echo "not on PATH"   # 1. is it on PATH at all?
pacman -Qo TOOL 2>/dev/null             # 2. (Arch) does any package own it?
pacman -F TOOL                          # 3. which repo package provides it (after pacman -Fy)
ls -l /path/to/expected/bin/TOOL        # 4. does the file exist and is it executable?
chmod +x /path/to/TOOL                  # 5. make a script executable
```

On a minimal Arch install, "not found" often just means the package isn't installed yet. `nano`, `ssh-keygen` (in `openssh`), and the build tools in `base-devel` were all missing on my first boot. See [Package management](/knowledge/linux-package-management-pacman-yay).

## Key takeaways

- PATH is an ordered list of directories, and the first match wins. Check with `type -a` and `which`.
- Use `export PATH=...` in `~/.bashrc` to make a change permanent, then `source ~/.bashrc`.
- Add directories, not files. Prepend to override, append to fall back.
- On WSL, Windows tools live under `/mnt/c/...`. Append their `bin` folder to PATH and quote the value.
- "Command not found" is usually a missing package or a missing PATH entry, rarely anything deeper.
