---
title: "Linux Command Reference: The Commands I Actually Use Day to Day"
category: "Linux: Commands & System Management"
slug: "linux-command-reference"
summary: "A task-organized cheat sheet of the Linux commands I use on my Arch workstation, covering files, processes, systemd and journalctl, packages, disks and mounts, networking, permissions, and NVIDIA GPU monitoring."
---

# Linux Command Reference

This is the cheat sheet I actually use on my Arch Linux workstation, an NVIDIA laptop running KDE Plasma that I use for development and local LLM inference. It's grouped by task. Most commands work on any distro. The package commands are Arch-specific (`pacman`/`yay`).

## Files and directories

```bash
ls -lah                         # long listing, hidden files, human-readable sizes
cd -                            # jump back to the previous directory
pwd                             # where am I
mkdir -p ~/code/{personal,experiments}   # create nested dirs (brace expansion makes several)
cp -r src/ dest/                # copy a directory recursively
mv old new                      # move or rename
rm -r dir/                      # delete a directory (no recycle bin, so be careful)
ln -s /real/path ~/link         # symlink (how I point tool caches at a shared folder)
readlink -f ~/link              # resolve a symlink to its real target
find ~ -name "*.gguf" -size +1G # find big model files
grep -rn "TODO" src/            # recursive search with line numbers
less file.log                   # page through a file (/ to search, q to quit)
tail -f file.log                # follow a growing log
head -n 50 file                 # first 50 lines
wc -l file                      # count lines
diff -q a b                     # do two files differ?
tar -czf out.tar.gz dir/        # compress a directory
tar -xzf out.tar.gz             # extract it
```

## Disk usage, disks, and mounts

```bash
df -h                           # free space per filesystem
du -sh ~/models/*               # size of each item (find what's eating the disk)
du -h --max-depth=1 ~ | sort -h # biggest top-level folders in home
lsblk -f                        # disks, partitions, filesystems, mountpoints, UUIDs
findmnt /                       # what's mounted at /, with its options and subvolume
findmnt /home
sudo mount /dev/sdX1 /mnt       # mount a partition
sudo umount /mnt                # unmount (umount -R for nested mounts)
cat /etc/fstab                  # boot-time mounts (entries look like UUID=<UUID>)
sudo btrfs filesystem usage /   # real usage on btrfs (df can mislead)
sudo btrfs subvolume list /     # subvolumes and snapshots
```

On my machine `/` is the Btrfs `@` subvolume and `/home` is `@home`. That split is what makes OS rollbacks safe. See [Snapshots and smoke tests](/knowledge/linux-snapshots-and-smoke-tests).

## Processes and resources

```bash
htop                            # interactive process viewer (or top)
ps aux | grep -E 'iwd|wpa_supplicant'   # is a particular process running
pgrep -a ollama                 # PIDs + command lines matching a name
kill PID                        # ask a process to exit (SIGTERM)
kill -9 PID                     # force-kill (last resort)
pkill -f name                   # kill by name pattern
free -h                         # RAM and swap
uptime                          # load average
ls -l /proc/PID/exe             # which binary a process runs (shows "(deleted)" if replaced)
nohup cmd &                     # run something that survives closing the terminal
plasma-systemmonitor            # KDE's graphical Task Manager
```

## systemd services

```bash
systemctl status NAME --no-pager          # state + recent log lines
sudo systemctl start|stop|restart NAME
sudo systemctl enable --now NAME          # start now and at every boot
sudo systemctl disable NAME
systemctl is-active NAME                  # one-word answer (good for scripts)
systemctl is-enabled NAME
systemctl --failed                        # anything broken this boot
systemctl --user status NAME              # per-user services
systemctl list-unit-files --state=enabled # what starts at boot
systemctl get-default                     # graphical.target for a desktop
sudo systemctl daemon-reload              # after editing unit files
```

A real example: NVIDIA's `nvidia-suspend`, `nvidia-resume`, and `nvidia-hibernate` services aren't enabled automatically with DKMS drivers, and suspend/resume can break without them.

## journalctl (logs)

```bash
journalctl -b                     # this boot
journalctl -b -1                  # previous boot
journalctl --list-boots           # all boots; a boot without a shutdown sequence = it hung
journalctl -b -p err              # only errors
journalctl -k -b                  # kernel messages
journalctl -u NetworkManager -b --no-pager   # one service
journalctl -u sddm -f             # follow live
journalctl --since "1 hour ago"
journalctl --disk-usage           # how big the journal is
sudo journalctl --vacuum-time=2weeks   # trim old logs
```

## Packages (Arch)

```bash
sudo pacman -Syu                  # full upgrade (never do partial upgrades)
sudo pacman -S --needed PKG       # install
sudo pacman -Rns PKG              # remove with unneeded deps
pacman -Ss KEYWORD                # search
pacman -Qi PKG                    # installed package info
pacman -Qo /usr/bin/FILE          # which package owns a file
pacman -Qe                        # explicitly installed packages
yay -S AUR_PKG                    # AUR install (never with sudo)
yay -Syu                          # upgrade repo + AUR
grep upgraded /var/log/pacman.log | tail   # what changed recently
flatpak list
```

Full details are in [Package management](/knowledge/linux-package-management-pacman-yay).

## Networking

```bash
nmcli device status               # interfaces and their state
nmcli device wifi list            # nearby networks, band, rate, signal
nmcli device wifi connect "SSID" --ask   # connect (asks for the password)
nmcli monitor                     # watch connect/disconnect events live
iw dev wlan0 link                 # negotiated Wi-Fi link rate and frequency
ip addr                           # interface addresses
ip route                          # default gateway
ping -c 3 archlinux.org           # basic connectivity
ss -tulpn                         # listening ports and which process owns them
curl -I https://example.com       # HTTP headers / reachability
resolvectl status                 # DNS (systemd-resolved)
```

I used `ss -tulpn` to confirm my local Ollama server listens only on loopback (`127.0.0.1`), not on every interface.

## Permissions and users

```bash
ls -l file                        # rwx for owner/group/others
chmod +x script.sh                # make executable
chmod 700 ~/.ssh                  # only me can enter
chmod 600 ~/.ssh/config ~/.ssh/id_ed25519   # only me can read/write
chown naitik:naitik file          # change owner
sudo -i                           # root shell (use sparingly)
id                                # my user, groups
groups                            # group memberships (e.g. docker, video)
sudo usermod -aG docker naitik    # add a user to a group (re-login after)
```

SSH refuses keys whose permissions are too open, so `700` for `~/.ssh` and `600` for keys and config aren't optional.

## Hardware and drivers

```bash
uname -r                          # running kernel version
lspci -k                          # PCI devices + bound kernel driver
lspci -nn | grep -Ei 'vga|nvidia|nvme|vmd'
lsusb                             # USB devices
lsmod | grep nvidia               # loaded kernel modules
dkms status                       # out-of-tree modules built per kernel
ldd /usr/bin/BINARY | grep "not found"   # missing shared libraries
wpctl status                      # PipeWire audio sinks/sources
aplay -l                          # ALSA playback devices
bluetoothctl show                 # Bluetooth controller state
echo $XDG_SESSION_TYPE            # wayland or x11
```

## GPU monitoring (NVIDIA)

```bash
nvidia-smi                        # snapshot: VRAM, utilization, power, temp, processes
watch -n 1 nvidia-smi             # refresh every second
nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu,power.draw,temperature.gpu,pstate --format=csv,noheader
nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv   # who holds VRAM
nvidia-smi dmon -s pucmt          # periodic samples: power, util, clocks, memory, temp
nvtop                             # htop-style GPU viewer (sudo pacman -S nvtop)
ollama ps                         # loaded models and GPU/CPU placement
```

How I read the numbers:

| Observation | Meaning |
|---|---|
| High VRAM, 0% util, P8 state | Model loaded but idle (normal) |
| High util during generation | Active inference |
| `ollama ps` says `100% GPU` | Model fits entirely in VRAM |
| CPU/GPU split | Model plus context overflowed VRAM, so it's much slower |
| Slow first reply, fast second | Model load and CUDA warm-up |
| Power plateaus well below the max | Firmware/performance-mode power ceiling, not a model setting |

On my laptop the GPU reported a 60 W active ceiling against a 140 W hardware maximum. That cap comes from the firmware performance mode. I don't touch `nvidia-smi -pl` without understanding cooling and the laptop's power sharing first.

## Shell productivity

```bash
history | grep pacman             # find a past command
Ctrl+R                            # reverse-search history
!!                                # repeat last command (sudo !! to rerun as root)
cmd 2>&1 | tee out.log            # see output and save it
cmd > /dev/null 2>&1              # silence everything
alias ll='ls -lah'                # shortcut (put it in ~/.bashrc)
source ~/.bashrc                  # reload shell config
export VAR=value                  # set an env var for this session
```

PATH details, including WSL, are in [PATH and shell setup](/knowledge/linux-path-and-shell-setup).

## Emergency keys

```text
Ctrl+Alt+F3      switch to a text console when the GUI is frozen or won't start
Ctrl+Alt+F1/F2   back to the graphical session (varies by display manager)
F11 / Delete     MSI one-time boot menu / BIOS setup
```

When things are really broken, see [Troubleshooting and recovery](/knowledge/linux-troubleshooting-recovery).

## Key takeaways

- Learn the four diagnostic pillars: `systemctl`, `journalctl`, `lsblk`/`findmnt`, and `lspci -k`/`ldd`.
- `du -sh`, `df -h`, and `btrfs filesystem usage` answer "where did my disk go?"
- `nvidia-smi`, `nvtop`, and `ollama ps` together show whether a local model really runs on the GPU.
- Permissions on `~/.ssh` matter. Use `700` for the folder and `600` for files.
- Keep a text console (`Ctrl+Alt+F3`) in mind. It works even when the desktop doesn't.
