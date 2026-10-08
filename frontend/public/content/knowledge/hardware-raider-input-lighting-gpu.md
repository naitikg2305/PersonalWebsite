---
title: "MSI Raider 16 Max on Arch Linux: Per-Key RGB, Lightbar, Face Login, Touchpad Gestures, and the RTX GPU"
category: "Linux: Hardware & Custom Kernel"
slug: "hardware-raider-input-lighting-gpu"
summary: "How I got the MSI Raider 16 Max's SteelSeries per-key RGB keyboard, front lightbar and lid logo, IR face login, touchpad gestures, and RTX 5070 Ti working on Arch Linux, including the community tools I built on and the problems I hit."
---

# Raider 16 Max on Arch: lighting, input, face login, and GPU

Apart from the [custom kernel I built for the speakers](/knowledge/hardware-raider-custom-kernel-audio), my MSI Raider 16 Max HX B2WH (subsystem `1462:14fb`) needed work in four other areas under Arch Linux and KDE Plasma 6 (Wayland): the RGB lighting, face login with the IR camera, touchpad gestures, and the NVIDIA GPU. I keep a strict habit for each one: a step doesn't count as done until its verification command passes.

| Feature | Hardware | Status |
| --- | --- | --- |
| Keyboard, lightbar, lid logo | SteelSeries KLC controller, USB `1038:1167` | Static profile at boot/resume, plus a reactive per-key effect |
| Face login | Camera `5986:11cf`: RGB on `/dev/video0`, IR 360x360 GREY on `/dev/video2` | Howdy enrolled; enabled for SDDM/KDE with password fallback |
| Touchpad gestures | ELAN touchpad `04f3:3352` | Windows-style three-finger gestures on Wayland |
| GPU | RTX 5070 Ti Laptop `10de:2f18` | `nvidia-open-dkms` built for `linux-raider`, verified with `nvidia-smi` |

## Keyboard, front lightbar, and lid logo

### The problem

The Raider has three lit areas: the per-key keyboard, a front lightbar across the chassis, and the rear lid logo. Out of the box on Linux the bar and logo ran MSI's factory breathing animation and there was nothing to control them with. The well-known tool [Askannz/msi-perkeyrgb](https://github.com/Askannz/msi-perkeyrgb) handles the keys but not the bar or logo.

### The tools (third-party, credited)

I didn't write the lighting protocol work. I use two community projects:

- **[msi-lightbar-linux](https://github.com/fenyxsomnia/msi-lightbar-linux)** by **fenyx**. It's an unofficial, MIT-licensed tool built for exactly this controller (`1038:1167`) on the Raider 16 HX. It drives keys, bar, and logo together through an `rgb` command with profiles (`glow`, `night`, `amber`, `xmas`, `rainbow`, `off`, and others) and has systemd persistence.
- **[msi-perkeyrgb](https://github.com/Askannz/msi-perkeyrgb)** by **Askannz** (MIT), which msi-lightbar-linux depends on for the HID wrapper, the per-region keyboard packets, and the keycode tables. Its protocol work credits **TauAkiou** for the effect protocol and **tbh1** for preset packet dumps. It was inspired by the older [MSIKLM](https://github.com/Gibtnix/MSIKLM).

Per msi-lightbar-linux's CREDITS, its bar/logo work also draws on community Wireshark captures in msi-perkeyrgb issue #70 and on the `omarchy-msi-rgb` project. fenyx's own contributions are the keycode sweep that found the bar/logo LEDs, the fix for the region-wipe count byte, the lock-LED handling, and the profile, persistence, and discovery tooling.

I read the source before running it, since it writes raw HID reports as root.

### How it works

The project's HACKING.md explains that the bar and logo aren't a separate device. They're **extra LEDs in the same key matrix**, at codes no physical key uses. Every change is a 524-byte HID feature report followed by a short "latch" output report. The main pitfall is that if a packet's entry count happens to equal one of the firmware's keyboard region IDs (`0x0b`, `0x18`, `0x24`, `0x2a`), the firmware wipes that whole region to black. The tool batches its writes so the count never lands on those values.

### What I set up and changed locally

```text
profile: glow
keyboard base: #4d1a00
lightbar and logo: #b34a00
```

- A root-owned `msi-lightbar.service` reapplies the profile at boot, running as my unprivileged user, and a sleep hook restarts it after resume.
- **Permission failure:** on one boot the service failed because both KLC `hidraw` nodes were `root:root 0600`. The fix was to create the `plugdev` group, add my user to it, reload the project's udev rule, and fix ownership on the existing nodes.
- **Launcher fixes:** my `msi-perkeyrgb` checkout sits next to the lightbar repo rather than in `~`, so I changed the `rgb` and `kbrgb` launchers to find that sibling checkout, keep `MSI_PERKEYRGB_PATH` across `sudo`, and call `msi_perkeyrgb.main` directly (that checkout has no `__main__.py`).
- **Reactive per-key fade (my addition):** I added `msi_lightbar/reactive.py` and per-LED packet support in `protocol.py`. The keyboard stays black while idle. Each key you press lights cyan (`#00ccff`) and fades quadratically to black over 1.2 s, capped at 20 fps, and it stops updating when nothing is fading. It reads the built-in keyboard from the stable path `/dev/input/by-path/platform-i8042-serio-0-event-kbd`, maps Linux keycodes to the GE75-compatible LED map from msi-perkeyrgb, and runs as a systemd **user** service (about 10 MiB RSS). My user is in the `input` group for this.

```bash
systemctl --user status msi-keyboard-reactive.service
systemctl --user disable --now msi-keyboard-reactive.service && rgb apply   # back to static
rgb show            # keyboard=#4d1a00  bar=#b34a00
rgb bar amber       # bar/logo colour on top of any keyboard profile
```

### Troubleshooting lessons

- **Stuck controller:** pressing `Fn+F8` once left the bar half-lit and the keyboard dark, even though `rgb show` still reported the last good state. The reliable reset is a **full shutdown, not a reboot**, then reapply a profile.
- **"Bar always off" wasn't a bug.** In the tool's profile table, only `glow` turns the bar and logo on. The others leave them off by design. You can set the bar on its own with `rgb bar <color>`.
- **Permission errors after a reboot** usually mean the session started before my `input`/`plugdev` membership took effect. Logging out and back in fixes it.
- An unrelated `/dev/hidraw*` node owned by root turned out to be the touchpad, not the lighting controller, so there was nothing to fix there.

## Face login with the IR camera (Howdy)

The camera has a dedicated 8-bit grayscale **IR stream** at 360x360 and 15 fps, next to the normal RGB webcam. I installed **Howdy** (the 3.4.0 "Howdy Next" AUR package). Its build tests passed. I pointed it at the IR node's stable `/dev/v4l/by-path/...` path, which survives renumbering, downloaded the YuNet and SFace models, enrolled my face, and confirmed a live match.

PAM gets `auth sufficient pam_howdy.so` **before** the password stack in `/etc/pam.d/sddm` and `/etc/pam.d/kde`. I made dated backups of both files first.

```bash
sudo howdy list -U naitik
sudo howdy test -U naitik
journalctl -b -t pam_howdy
sudo howdy disable true       # turn it off without deleting the model
```

My rules for this:

- Keep the password as a fallback. Never make face recognition the only PAM method. ([Howdy's upstream](https://github.com/boltgolt/howdy) warns against relying on it for security.)
- Test with `sudo` in a separate root-capable terminal before enabling it for the display manager.
- Face login doesn't type your password, so it can't unlock a password-protected KDE Wallet.
- If you get locked out, restore the dated PAM backups from a TTY.

**Camera mix-up:** the IR camera also appears as a normal camera ("Integrated IR Camera"). When Teams in Chrome showed a black webcam, it had simply picked the IR device. Choosing "FHD Webcam" fixed it immediately.

## Windows-style touchpad gestures on Wayland

`libinput-gestures` watches the ELAN touchpad's stable path. Instead of injecting X11 keystrokes, its actions call KWin's `org.kde.kglobalaccel.Component.invokeShortcut` over D-Bus through a small helper script, so the gestures also work with native Wayland apps:

- three fingers up: Overview
- three fingers down: Show Desktop
- three fingers left/right: next/previous application

It starts automatically at login. To check it: `libinput-gestures-setup status`, or `libinput-gestures -d` for live debugging.

## RTX 5070 Ti

The discrete GPU uses NVIDIA's **open kernel modules** through Arch's `nvidia-open-dkms`. With a custom kernel, DKMS is the right choice because it rebuilds the module for `linux-raider`, as long as **`linux-raider-headers` stays installed**. `nvidia-smi` reports the RTX 5070 Ti Laptop GPU with 12,227 MiB VRAM.

```bash
lspci -nnk -s 01:00.0
dkms status
nvidia-smi
```

### The suspend freeze

On driver 610.57.04 the laptop sometimes hard-froze a few minutes after resuming while docked. The journal showed `nvidia-modeset` deadlocked in the DIFR prefetch path, with KWin blocked behind it. I first enabled `nvidia-suspend`, `nvidia-resume`, and `nvidia-hibernate`. When the freeze came back, I traced it to an upstream bug in NVIDIA's open-gpu-kernel-modules (issues #1289/#1246) that was fixed in **615.71.09**. I upgraded, and DKMS rebuilt the module for `7.1.10-arch1-6-raider`.

**Gotcha:** right after the upgrade, `nvidia-smi` printed `Failed to initialize NVML: Driver/library version mismatch`. That's expected: the userspace libraries are new but the loaded kernel module is still the old one (check `/proc/driver/nvidia/version`). Rebooting fixes it. The freeze fix is only active after that reboot, and I saw no deadlock signature after it.

**Power note:** a driver update doesn't raise the GPU's wattage. Power is capped by the laptop's TGP/Dynamic Boost in firmware. To read it:

```bash
nvidia-smi --query-gpu=name,driver_version,power.draw,power.limit,temperature.gpu,utilization.gpu,memory.used,memory.total --format=csv
```

Containers can hide `/dev/nvidia*`, so I always check the GPU on the host.

## Key takeaways

- On this Raider, the lightbar and lid logo are just extra LEDs in the keyboard matrix. Credit for working that out goes to fenyx's msi-lightbar-linux, built on Askannz's msi-perkeyrgb. I added a reactive per-key effect and fixed the launchers and permissions for my setup.
- For lighting glitches, do a full power-off before anything else. Reboots don't reset the controller.
- Use stable device paths (`/dev/input/by-path`, `/dev/v4l/by-path`) and group membership (`input`, `plugdev`) instead of `chmod` on numbered nodes.
- Face unlock should only ever be `sufficient` with the password kept behind it, and you need a PAM backup before you start.
- On a custom kernel, keep the matching headers package installed so DKMS can rebuild NVIDIA modules. After a driver upgrade, an NVML version mismatch just means you haven't rebooted yet.
