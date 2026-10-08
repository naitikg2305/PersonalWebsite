---
title: "KDE Plasma on Arch: Fixing a 'Broken' Desktop, SDDM Crashes, and Installing My Apps"
category: "Linux: My Arch Install (MSI Raider 16 Max)"
slug: "arch-kde-desktop-and-apps"
summary: "How I got a normal KDE Plasma desktop working on my MSI Raider 16 Max (escaping Plasma Bigscreen, fixing an SDDM greeter crash from missing Qt5 libraries and a black screen at boot caused by Xorg probing the NVIDIA GPU), then set up my apps with pacman, yay, Flatpak and browser web apps."
---

# KDE Plasma on Arch: Fixing a "Broken" Desktop, SDDM Crashes, and Installing My Apps

## What happened

Arch booted fine on my MSI Raider 16 Max, but the desktop experience was confusing at first. At one point I had giant tiles, no taskbar, and odd fullscreen behavior that looked more like a game console than a desktop. Later the login screen stopped appearing at all. None of it meant Arch was broken. It was several independent layers, each missing one piece:

```text
Arch base system
-> KDE packages
-> Plasma session choice
-> SDDM greeter
-> Qt runtime dependencies
-> GPU/Xorg configuration for the login screen
-> plasma-nm / NetworkManager GUI integration
```

This article works through those layers in the order I hit them, then covers how I installed my everyday apps.

## Step 1: Install Plasma and the login manager

The first minimal GUI install:

```bash
sudo pacman -S plasma sddm konsole
sudo systemctl enable sddm
sudo reboot
```

`plasma` is a package group, so pacman asks you to pick providers. I chose **FFmpeg** for multimedia and **PipeWire** for audio, and accepted the defaults for fonts and Tesseract OCR data.

That wasn't enough for a complete desktop. Things got much better once I installed the standard meta package and its integrations:

```bash
sudo pacman -S plasma-meta plasma-nm dolphin konsole sddm
sudo systemctl enable --now NetworkManager
```

| Package | Role |
|---|---|
| `plasma-meta` | The standard set of Plasma desktop components |
| `plasma-nm` | KDE's Wi-Fi and network GUI (on top of NetworkManager) |
| `dolphin` | File manager |
| `konsole` | Terminal |
| `sddm` | Graphical login manager |

Other GUI basics I added:

```bash
sudo pacman -S dolphin ark spectacle kate git base-devel
```

(Ark is the archive manager, Spectacle takes screenshots, and Kate is a text editor.)

## Problem 1: The desktop looked like a TV launcher

The console-style UI with big tiles was **Plasma Bigscreen**, a separate Plasma shell designed for TVs. It had been selected as the session. The fix is to log out and choose this on the SDDM session picker:

```text
Plasma (Wayland)
```

not "Plasma Bigscreen". The normal session has the panel/taskbar, app launcher, system tray, movable windows with minimize/maximize/close, standard System Settings, and Wayland touchpad gestures. Once I'd confirmed normal Plasma worked, removing Bigscreen became an option:

```bash
sudo pacman -Rns plasma-bigscreen
```

Only remove it **after** confirming the normal session works.

## Problem 2: SDDM greeter crashed with exit code 127

After the session switch, the machine booted to a text screen instead of the login screen. I switched to a TTY with **Ctrl+Alt+F3** and checked:

```bash
systemctl status sddm --no-pager
```

The greeter was exiting with status **127**, which usually means "command or library not found". The Plasma Wayland session files were all there, so I checked the greeter binary's shared libraries:

```bash
ldd /usr/bin/sddm-greeter | grep "not found"
```

It listed missing **Qt5** libraries. The fix:

```bash
sudo pacman -S --needed qt5-base qt5-declarative
ldd /usr/bin/sddm-greeter | grep "not found"
sudo systemctl restart sddm
```

When the `ldd` check printed nothing, the restart brought back the normal login screen.

## Problem 3: Black screen at every boot (a different bug)

Later I had a different failure. For about ten days, every boot needed a manual `sudo systemctl restart sddm` from a TTY because the login screen never appeared. This time `systemctl status sddm` said the service had started successfully. Nothing had crashed.

`journalctl -b -u sddm` showed the greeter starting and then roughly 90 seconds of silence. The real evidence was in **`/var/log/Xorg.0.log`**. Xorg correctly opened a screen on the Intel iGPU and found the internal panel (`eDP-1`). Then its automatic GPU probing **also** added the NVIDIA card as a second "GPU screen", which failed:

```text
(EE) modeset(G0): Failed to create pixmap
```

On this laptop the internal panel is wired **only** to the Intel GPU, with no MUX switch, so the NVIDIA GPU has no display attached. Xorg trying to use it either hung the session on the wrong virtual terminal (intermittently) or crashed X.

**The fix** was `/etc/X11/xorg.conf.d/10-intel-only-display.conf`:

```text
Section "ServerFlags"
    Option "AutoAddGPU" "false"
EndSection

Section "Device"
    Identifier "IntelGPU"
    Driver "modesetting"
    BusID "PCI:0:2:0"
EndSection

Section "Screen"
    Identifier "IntelScreen"
    Device "IntelGPU"
EndSection
```

`PCI:0:2:0` is the Intel GPU's bus ID in decimal, taken from `lspci -nn | grep VGA` (`00:02.0`).

**My first attempt made things worse.** I only declared the Intel `Device` and `Screen` sections and left out `ServerFlags`. Modern Xorg still auto-adds every other GPU as a provider, so the intermittent hang became a crash on **every** boot. I deleted the file to get back to the old state, then added `Option "AutoAddGPU" "false"`, which is the line that actually stops Xorg from touching the NVIDIA GPU at startup. After a full reboot on 2026-09-04, SDDM came up normally.

This doesn't affect GPU use inside the desktop. Apps still use the NVIDIA GPU through PRIME render offload (`prime-run`), which works independently of which GPU drives the login screen.

## Desktop layout and recovery commands

To make Plasma feel like Windows:

```text
Right-click desktop -> Configure Desktop and Wallpaper -> Layout -> Folder View
Right-click desktop -> Enter Edit Mode -> Add Panel -> Default Panel
Right-click Application Launcher -> Show Alternatives -> Application Launcher
```

(I avoided Application Dashboard, which is a fullscreen launcher.)

To check that I'm on Wayland:

```bash
echo $XDG_SESSION_TYPE
```

Built-in four-finger gestures worked out of the box. Custom three-finger gestures needed extra tooling, covered in [Input, Lighting, and GPU](/knowledge/hardware-raider-input-lighting-gpu).

Commands worth remembering when the desktop misbehaves:

```bash
kquitapp6 plasmashell
plasmashell --replace &
sudo systemctl restart sddm
systemctl get-default
sudo systemctl set-default graphical.target
```

## Installing my apps

### pacman, yay and Flatpak

`pacman` handles the official repos. The **AUR** (community packages) needs a helper, so I built `yay` first:

```bash
sudo pacman -S --needed base-devel git
git clone https://aur.archlinux.org/yay.git
cd yay
makepkg -si
yay --version
```

What I installed and kept:

| App | How |
|---|---|
| Google Chrome | `yay -S google-chrome` |
| VS Code | `yay -S visual-studio-code-bin` (official Microsoft build) |
| Cursor | `yay -S cursor-bin` (fallback: the official AppImage in `~/Applications`) |
| Slack | `yay -S slack-desktop` |
| ONLYOFFICE | `yay -S onlyoffice-bin` (better Microsoft Office formatting fidelity than LibreOffice) |
| Node.js / npm | `sudo pacman -S nodejs npm` |
| Claude Code | `npm install -g @anthropic-ai/claude-code` (see the gotcha below) |
| Spotify | `flatpak install --user flathub com.spotify.Client` |
| Camera apps | GNOME Snapshot and KDE Kamoso via Flatpak |

A big wall of build output while installing Chrome through yay is normal. A warning about missing `less` only affects viewing package diffs (`sudo pacman -S less` fixes it).

For Spotify, Flathub was registered only system-wide, so I first added it as a **user** remote. After that, user-scope installs need no sudo:

```bash
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
```

### Apps with no Linux client

- **Microsoft Teams, Outlook, ChatGPT, Claude:** opened in Chrome and installed as web apps ("Install page as app"), so each gets its own window, a launcher entry and notifications. I avoided unofficial wrapper apps. Thunderbird (`sudo pacman -S thunderbird`) is the native mail alternative.
- **Netflix and Prime Video:** Chrome doesn't offer to install either one as an app, so I made `.desktop` launchers that run `google-chrome --app=<url>`. DRM playback works because Chrome bundles Widevine.

### Gotcha: Claude Code's native binary

A plain global npm install failed with `postinstall script blocked` and then `claude native binary not installed`. npm's script policy blocked the postinstall step that installs the native binary. Allowing scripts for that one package fixed it, and setting the policy in my user npm config stopped the CLI's own auto-updates from breaking it again:

```bash
npm config set allow-scripts=@anthropic-ai/claude-code --location=user
```

### SSH for multiple GitHub accounts

I use separate ed25519 keys for my personal and work GitHub accounts, with host aliases in `~/.ssh/config`, so each repo uses the right identity:

```sshconfig
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes
```

Then `git clone git@github-personal:USER/REPO.git`. Run `chmod 700 ~/.ssh` and `chmod 600 ~/.ssh/config`, and test with `ssh -T git@github-personal`.

## Key takeaways

- A "broken" KDE desktop on Arch is usually a missing piece. Install `plasma-meta`, not just the bare minimum.
- If it looks like a TV interface, you're in Plasma Bigscreen. Pick **Plasma (Wayland)** at login.
- When SDDM exits with code 127, run `ldd` on `sddm-greeter` and look for "not found".
- If the service is "running" but the screen stays black, read `Xorg.0.log`. On hybrid laptops without a MUX, `AutoAddGPU false` stops Xorg from probing the GPU that has no display.
- Use pacman for the official repos, yay for the AUR, Flatpak (user scope) for proprietary apps like Spotify, and Chrome web apps where no Linux client exists.
