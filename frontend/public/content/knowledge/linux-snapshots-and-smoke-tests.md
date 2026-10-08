---
title: "Btrfs Snapshots, Rollbacks, Smoke Tests, and Managing Local AI Models on Disk"
category: "Linux: Commands & System Management"
slug: "linux-snapshots-and-smoke-tests"
summary: "My low-maintenance Arch update loop (snapshot, update, reboot, smoke test) and how I lay out the disk so OS rollbacks never touch my code or my multi-gigabyte AI model weights."
---

# Snapshots, Smoke Tests, and Managing Local Models

I want my Linux workstation to be boring. The goal fits in four words: **tinker with code, not with the machine.** Arch is a rolling-release distro, so I built a routine that makes updates low-risk:

```text
snapshot -> update -> reboot -> smoke test -> done (or roll back)
```

This page covers the disk layout that makes the routine work, how I think about snapshots, the smoke test I run after updates, and how I keep large local AI models from filling the disk.

## The Btrfs layout that makes rollback safe

My root filesystem is Btrfs with two subvolumes:

```text
@      -> /       OS, packages, /etc config, drivers, boot-related state
@home  -> /home   code, SSH keys, dotfiles, models, documents, venvs
```

Because they're separate subvolumes, I can roll back the OS without rewinding my own work:

```text
Tuesday:   snapshot root, update system, edit code.py to v2
Wednesday: the update broke the NVIDIA driver, so I roll back root
Result:    OS is back to the pre-update state, and code.py is still v2
```

Useful commands for checking the layout:

```bash
findmnt /                          # confirm / is btrfs and see its subvol
findmnt /home                      # confirm /home is the @home subvolume
sudo btrfs subvolume list /        # list subvolumes, including snapshots
sudo btrfs filesystem usage /      # real space usage (df can mislead on btrfs)
```

## How snapshots actually behave

- **Snapshots are subvolumes, not files.** Don't copy them into a folder like `~/linux/snapshots/`. Manage them with Btrfs tooling such as Snapper or Timeshift. My `~/linux/` folder holds snapshot *scripts, policy, and logs*, not the snapshots themselves.
- **They start almost free.** Btrfs is copy-on-write. If root references 70 GiB and I take a snapshot, extra usage is near zero. If an update then changes 4 GiB of blocks, the snapshot holds on to roughly those 4 GiB of old blocks.
- **Don't keep them forever.** My policy is 5 to 10 recent snapshots plus a few known-good checkpoints. Prune the rest.
- **Snapshots aren't backups.** If the SSD dies, the snapshots on it die too. Important data also needs an off-machine copy.

Taking a read-only root snapshot by hand before an update looks like this. Snapper wraps the same idea with automatic numbering and cleanup.

```bash
sudo mkdir -p /.snapshots
sudo btrfs subvolume snapshot -r / /.snapshots/root-pre-update-$(date +%F)   # read-only root snapshot
sudo btrfs subvolume list /                                                  # confirm it exists
sudo btrfs subvolume delete /.snapshots/root-pre-update-YYYY-MM-DD           # prune an old one
```

My preferred long-term setup is Btrfs plus Snapper, with automatic pre-update root snapshots and optional bootloader integration so I can boot a snapshot straight from the GRUB menu. To roll back, boot a snapshot or the live USB, then replace or re-point `@` with the known-good snapshot. [Troubleshooting and recovery](/knowledge/linux-troubleshooting-recovery) covers the USB and chroot side.

## The monthly update routine

```text
1. Read Arch news for any manual interventions
2. Create a Btrfs root snapshot
3. sudo pacman -Syu
4. Reboot
5. Run the smoke test
6. PASS: keep working
7. FAIL: diagnose, or roll back the snapshot
```

```bash
sudo pacman -Syu                         # full upgrade (never partial)
yay -Syu                                 # also upgrade AUR packages
grep -E 'upgraded' /var/log/pacman.log | tail -30   # what just changed
sudo reboot
```

This routine is what keeps Arch from turning into a hobby of its own.

## Smoke tests: "did this update break anything I care about?"

After every update I want a short PASS/WARN/FAIL summary instead of trying to remember what to check by hand. The checks live in their own folder (`~/linux/smoke-test/`), separate from my project code.

### What I check, by area

```bash
# System
uname -r                          # running kernel (I build a custom one, so check the suffix)
systemctl --failed                # nothing should be failed
findmnt -n -o FSTYPE /            # root is still btrfs

# Network
systemctl is-active NetworkManager
nmcli device status
ping -c 3 archlinux.org
ps aux | grep -E 'iwd|wpa_supplicant'    # the intended Wi-Fi backend is the one running

# GPU / CUDA
nvidia-smi
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO CUDA')"

# Dev tools
ssh -T git@github-personal        # SSH key + GitHub auth still work
node --version && npm --version
docker version                    # if Docker is installed

# Audio / Bluetooth
wpctl status                      # real sinks, not just "Dummy Output"
systemctl is-active bluetooth
bluetoothctl show                 # controller is "Powered: yes"
```

Don't stop at `torch.cuda.is_available() == True`. Run **one tiny real model inference** too. That single test proves the whole chain: driver, CUDA, PyTorch, model load, inference.

For Docker GPU checks, pin a specific known-good CUDA image tag instead of `latest`.

### The script pattern

My real script is a few dozen lines of bash with three counters and helper functions. It exits non-zero if anything failed, so I can chain it into other scripts.

```bash
#!/usr/bin/env bash
set -u
pass=0; warn=0; fail=0
ok()      { printf 'PASS: %s\n' "$*"; pass=$((pass+1)); }
warning() { printf 'WARN: %s\n' "$*"; warn=$((warn+1)); }
failure() { printf 'FAIL: %s\n' "$*"; fail=$((fail+1)); }
have()    { command -v "$1" >/dev/null 2>&1; }

[[ $(uname -r) == *-custom ]] && ok "custom kernel active" || warning "stock kernel running"

state=$(systemctl is-active bluetooth.service 2>&1 || true)
[[ $state == active ]] && ok "Bluetooth active" || failure "Bluetooth not active"

findmnt -n -o FSTYPE / | grep -qx btrfs && ok "root is Btrfs" || warning "root not Btrfs"

if journalctl -k -b --no-pager | grep -q 'No SoundWire machine driver found'; then
  failure "kernel fell back: no SoundWire machine driver"
else
  ok "no SoundWire fallback this boot"
fi

printf '\nSummary: %d passed, %d warnings, %d failed\n' "$pass" "$warn" "$fail"
(( fail == 0 ))
```

Design choices I'd keep:

- **WARN vs FAIL.** Something that can't be checked right now (for example, permission denied inside a sandbox) is a warning, not a failure.
- **Check for known regressions by log signature.** My internal speakers depend on a kernel fix, so the script greps the kernel log for the exact fallback message.
- **Keep the output short:**

```text
PASS: NetworkManager
PASS: Internet
PASS: NVIDIA driver
PASS: PyTorch CUDA
PASS: Tiny model inference
WARN: Internal audio still waiting on upstream SoundWire support
```

## Managing local AI models on disk

I run local LLMs with Ollama and Hugging Face. Model weights run from a few GB to tens of GB each, so the rule is: **one shared model store, never weights inside repos.**

```text
~/code/            Git repos, each with its own .venv
~/models/          shared model weights and caches
~/linux/           machine scripts, docs, smoke tests, config templates
~/Applications/    AppImages
```

Every repo gets its own Python virtual environment, but they all share one cache:

```bash
export HF_HOME="$HOME/models/huggingface"     # in ~/.bashrc: all HF downloads go here
export OLLAMA_MODELS="$HOME/models/ollama"    # point Ollama at the shared store
# or: ln -s ~/models/ollama ~/.ollama/models  # symlink Ollama's default path to it
```

That keeps Python dependencies isolated without hundreds of GB of duplicate weights. Since it all lives under `/home`, the models also survive an OS rollback.

Day-to-day model housekeeping:

```bash
ollama list                    # models on disk and their sizes
ollama pull qwen3:8b           # download a model (needs internet)
ollama rm MODEL_NAME           # delete one to free space
ollama show qwen3:14b          # metadata: parameters, quantization, context
ollama ps                      # what's loaded, and whether it's 100% GPU or spilling to CPU
du -sh ~/models/*              # what's using the space
watch -n 1 nvidia-smi          # live VRAM while generating
```

On my 12 GB GPU, measured runtime VRAM at an 8K context was about 3.9 GB for Qwen3 4B, 6.3 GB for 8B, and 10 GB for 14B. All three ran 100% on the GPU. The boundary that matters is `100% GPU` in `ollama ps`. Once a model spills to the CPU, speed collapses.

## Optional: version the machine folder

`~/linux/` can be its own Git repo holding scripts, docs, config templates, and smoke tests. **Never commit secrets** to it:

```gitignore
*.log
*.key
*.pem
secrets/
private/
```

## Key takeaways

- Keep `@` (OS) and `@home` (your data) as separate subvolumes so OS rollbacks never touch your work.
- Snapshots are cheap copy-on-write subvolumes, but they aren't backups. Prune them to 5 to 10.
- Update loop: snapshot, `pacman -Syu`, reboot, smoke test, roll back if needed.
- Smoke tests should exercise real paths, including one real model inference, and print a PASS/WARN/FAIL summary.
- Keep one shared model store (`HF_HOME`, `OLLAMA_MODELS`) and a `.venv` per repo. Never keep weights inside repos.
