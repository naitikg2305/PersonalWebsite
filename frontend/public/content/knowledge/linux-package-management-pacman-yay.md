---
title: "Arch Package Management and KDE Desktop: pacman, yay, Flatpak, and PWAs"
category: "Linux: Commands & System Management"
slug: "linux-package-management-pacman-yay"
summary: "How I install, update, query, and remove software on Arch Linux with pacman, the AUR helper yay, and Flatpak, plus how I fixed an incomplete KDE Plasma desktop."
---

# Package Management on Arch, and Getting KDE Right

On Arch, almost everything on my machine came from one of four places, and I pick in this order:

1. **pacman**: official Arch repositories. Signed, fast, and always my first choice.
2. **yay**: an AUR helper. The AUR (Arch User Repository) holds community build scripts for things like Google Chrome, VS Code, Cursor, and Slack.
3. **Flatpak (Flathub)**: sandboxed apps. I use it when the official vendor build is published there (Spotify, for example).
4. **Browser PWA / app mode**: for services with no native Linux client, like Teams, Outlook Web, ChatGPT, and streaming sites.

## pacman essentials

### Install and update

```bash
sudo pacman -Syu                     # sync repos + full system upgrade (the only safe way to update)
sudo pacman -S PACKAGE               # install a package
sudo pacman -S --needed PKG1 PKG2    # install, skipping anything already up to date
sudo pacman -Sy archlinux-keyring    # refresh signing keys if upgrades fail on signatures
sudo pacman -Su                      # then upgrade everything (right after refreshing the keyring)
```

**Never do partial upgrades.** That means don't run `pacman -Sy PACKAGE` alone and don't upgrade just one driver. Arch assumes every package is in sync. When I needed a fixed NVIDIA driver, the right move was a full `-Syu`.

### Search and inspect

```bash
pacman -Ss KEYWORD          # search the repos
pacman -Si PACKAGE          # details of a repo package
pacman -Q PACKAGE           # is it installed, and which version
pacman -Qi PACKAGE          # details of an installed package
pacman -Qe                  # packages I explicitly installed
pacman -Qm                  # "foreign" packages (AUR/manual builds)
pacman -Ql PACKAGE          # files a package owns
pacman -Qo /usr/bin/thing   # which package owns this file
pacman -Qdt                 # orphans: dependencies nothing needs anymore
```

### Remove and clean

```bash
sudo pacman -R PACKAGE          # remove a package
sudo pacman -Rns PACKAGE        # remove it plus unneeded deps and its config backups
sudo pacman -Rns $(pacman -Qdtq) # remove all orphans (review the list first)
sudo paccache -r                # keep only the last 3 cached versions (pacman-contrib)
```

### History

```bash
grep -E 'installed|upgraded|removed' /var/log/pacman.log | tail -40   # what changed recently
```

The pacman log is the first thing I check when something breaks after an update. It also rules out a suspected "auto-update". Arch doesn't update itself.

## yay and the AUR

yay isn't in the official repos, so you build it once with `makepkg`:

```bash
sudo pacman -S --needed base-devel git
git clone https://aur.archlinux.org/yay.git
cd yay
makepkg -si
```

Then it works like pacman and covers both the repos and the AUR:

```bash
yay -S google-chrome              # install from AUR
yay -S visual-studio-code-bin     # "-bin" = prebuilt upstream binary, no long compile
yay -S cursor-bin
yay -S slack-desktop
yay -S onlyoffice-bin
yay -Syu                          # upgrade repo + AUR packages
yay -Ss KEYWORD                   # search both
yay -Rns PACKAGE                  # remove
```

Don't run yay with sudo. It asks for elevation itself when it needs it. AUR packages are community-maintained, so read the PKGBUILD for anything unfamiliar.

## Flatpak

```bash
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub com.spotify.Client
flatpak install --user flathub org.gnome.Snapshot   # simple camera app, works on KDE via portals
flatpak list
flatpak update
flatpak uninstall --user APP_ID
```

Lesson learned: Flathub was only registered system-wide on my machine, so `--user` installs failed until I added it as a *user*-scope remote. After that, user installs need no sudo.

## Apps with no Linux client

- **Teams, Outlook Web, ChatGPT, Claude**: open in Chrome, then choose "Install page as app". This creates a proper launcher in the app menu.
- **Streaming sites** that won't offer an install button: make a `.desktop` launcher that runs `google-chrome --app=<url>`. DRM playback works because Chrome bundles Widevine.
- **AppImages** go in `~/Applications/`.

## npm global CLIs

```bash
sudo pacman -S nodejs npm
npm config get prefix             # where global installs land
```

Don't mix root-owned and user-owned global npm installs. If a CLI's postinstall step gets blocked by npm's script policy, the command can end up as a broken stub. Allow that specific package's scripts instead of turning all scripts on.

## KDE Plasma: from "broken-looking" to a normal desktop

My first KDE install was minimal:

```bash
sudo pacman -S plasma sddm konsole
sudo systemctl enable sddm
```

The result looked like a TV/console launcher with giant tiles and no taskbar. Two things had gone wrong.

**1. I was in Plasma Bigscreen.** That's a TV interface, not the desktop. The fix is to log out and choose **Plasma (Wayland)** on the login screen. Once normal Plasma worked, I removed Bigscreen:

```bash
sudo pacman -Rns plasma-bigscreen
```

**2. Core desktop pieces were missing.**

```bash
sudo pacman -S plasma-meta plasma-nm dolphin konsole sddm
sudo systemctl enable --now NetworkManager
```

```text
plasma-meta  -> the standard Plasma desktop components
plasma-nm    -> Wi-Fi/network applet (internet worked, but there was no GUI for it)
dolphin      -> file manager
konsole      -> terminal
sddm         -> graphical login manager
```

A useful baseline on top of that:

```bash
sudo pacman -S ark spectacle kate git base-devel   # archives, screenshots, editor, build tools
```

### KDE recovery commands

```bash
echo $XDG_SESSION_TYPE                  # should print "wayland"
kquitapp6 plasmashell                   # stop a frozen panel/desktop shell
plasmashell --replace &                 # start it again
sudo systemctl restart sddm             # restart the login manager
systemctl get-default                   # should be graphical.target
sudo systemctl set-default graphical.target
```

If the login screen won't come up, press `Ctrl+Alt+F3` for a text console. When SDDM's greeter crashed with exit code 127, `ldd /usr/bin/sddm-greeter | grep "not found"` showed missing Qt5 libraries, and `sudo pacman -S --needed qt5-base qt5-declarative` fixed it. More in [Troubleshooting and recovery](/knowledge/linux-troubleshooting-recovery).

### Layout tweaks

- Taskbar: right-click the desktop, choose Enter Edit Mode, then Add Panel, then Default Panel.
- Desktop icons: right-click the desktop, choose Configure Desktop and Wallpaper, then Layout: Folder View.
- Start menu: right-click the launcher, choose Show Alternatives, then Application Launcher (avoid the fullscreen Dashboard).
- Four-finger touchpad gestures work by default on Wayland. Remapping three-finger gestures is a preference, not a broken touchpad.

## Key takeaways

- Use pacman first, yay for AUR, Flatpak for official sandboxed builds, and a PWA when nothing native exists.
- Always do full upgrades (`-Syu`). Partial upgrades are how Arch systems break.
- `/var/log/pacman.log` is the source of truth for "what changed?"
- Install `base-devel` and `git` before building yay. Never run yay as root.
- A weird-looking KDE usually means an incomplete install (`plasma-meta`, `plasma-nm`) or the wrong session (Bigscreen), not a broken OS.
