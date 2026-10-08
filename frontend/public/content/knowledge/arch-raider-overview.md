---
title: "My Arch Linux Install on the MSI Raider 16 Max: Overview and Timeline"
category: "Linux: My Arch Install (MSI Raider 16 Max)"
slug: "arch-raider-overview"
summary: "A hub page for how I set up Arch Linux alongside Windows on my MSI Raider 16 Max: the hardware, my goals, the order of the steps, what changed over time, and where each part is documented in detail."
---

# My Arch Linux Install on the MSI Raider 16 Max: Overview and Timeline

## What this is

In August 2026 I set up Arch Linux as my main workstation OS on my **MSI Raider 16 Max**, keeping the factory Windows install so the laptop dual-boots. I wrote everything down as I went: every command, every failure, every fix. These articles turn those notes into a guide someone could follow on similar hardware. They're also an honest record of what actually happened on this machine.

This page is the hub. It covers the hardware, why I made the main decisions, the order I did things in, and a dated log of what changed after the install.

## The machine

| Component | Details |
|---|---|
| Laptop | MSI Raider 16 Max HX B2WH (board `MS-2651`) |
| Platform | Intel Arrow Lake (Intel 800-series audio, Intel iGPU) |
| Discrete GPU | NVIDIA RTX 5070 Ti Laptop GPU, 12 GB VRAM |
| Display wiring | Hybrid (Optimus-style): the internal panel is wired only to the Intel iGPU, with no MUX switch |
| Storage | One ~1 TB NVMe SSD (953.9 GiB), shared by Windows and Arch |
| Wireless | Intel Wi-Fi 7 BE200 (Wi-Fi and Bluetooth on one card) |
| Audio | SoundWire: Realtek RT713 jack codec plus two RT1320 smart amplifiers |
| Cameras | An FHD RGB webcam plus an infrared camera (used for face login) |

The hardware was very new when I installed Linux on it. That turned out to matter more than anything else: Arch had current packages, but the kernel's model-specific tables didn't know this exact audio layout yet.

## Goals

- **Keep Windows.** Leave the Windows install, its EFI files and its recovery partitions working and untouched.
- **A real daily-driver Linux desktop:** KDE Plasma on Wayland, normal Wi-Fi and Bluetooth, working audio, and the NVIDIA GPU available for CUDA/ML work.
- **Safe updates.** Arch is rolling-release, so I wanted a filesystem that could roll back a bad update. That's why I chose Btrfs with separate `@` (root) and `@home` subvolumes.
- **Reproducible.** If I ever rebuild or switch laptops, I shouldn't have to start from zero.

## The main decisions at a glance

| Decision | Choice | Why |
|---|---|---|
| Install method | `archinstall` (guided installer) with manual partitioning | Faster and less error-prone than a fully manual pacstrap install, but still lets me control the disk layout |
| Filesystem | Btrfs, subvolumes `@` -> `/` and `@home` -> `/home` | Snapshots and cheap copy-on-write rollback points. The OS can be rolled back without touching my code and files |
| EFI | Reuse Windows' existing EFI System Partition, mounted at `/boot/efi`, **never formatted** | Windows Boot Manager lives there. Formatting it would break Windows |
| Desktop | KDE Plasma (Wayland) with SDDM | Full-featured, Windows-like layout possible, good Wayland touchpad gestures |
| Networking | NetworkManager + `plasma-nm`, with **iwd** as the Wi-Fi backend | wpa_supplicant kept timing out during authentication. iwd fixed it |
| Audio | PipeWire + WirePlumber | The modern Arch default. Internal speakers needed a custom kernel (see below) |
| Kernels | Stock `linux` kept as the recovery path, plus a custom `linux-raider` | The custom kernel adds the missing speaker support without replacing the stock kernel |

## The order I did things in

1. **Prepare Windows and the BIOS.** Suspend BitLocker, force one Safe Mode boot, disable Intel VMD in a hidden BIOS menu so Linux can see the NVMe, and free up unallocated space. See [Dual Boot Prep: BIOS, BitLocker, VMD, and Partitioning](/knowledge/arch-dual-boot-partitioning).
2. **Install Arch.** Boot the official ISO, get online with `iwctl`, run `archinstall` with manual partitioning, Btrfs subvolumes and the shared ESP. See [Installing Arch with archinstall](/knowledge/arch-install-walkthrough).
3. **Make the desktop usable.** Install the full Plasma set, get out of Plasma Bigscreen by accident, fix an SDDM crash caused by missing Qt5 libraries, then fix a black screen at boot caused by Xorg probing the NVIDIA GPU. Then install apps through pacman, yay (AUR) and Flatpak. See [KDE Plasma Desktop and Apps](/knowledge/arch-kde-desktop-and-apps).
4. **Networking, Bluetooth and audio.** Switch Wi-Fi to iwd, enable Bluetooth, and track the missing internal speakers down to the kernel. See [Wi-Fi, Bluetooth, and Audio](/knowledge/arch-network-bluetooth-audio).
5. **Hardware-specific work** (covered separately):
   - The custom `linux-raider` kernel that makes the internal speakers work: [Custom Kernel and Speaker Audio](/knowledge/hardware-raider-custom-kernel-audio).
   - Face login, touchpad gestures, keyboard and lightbar RGB, and the RTX GPU: [Input, Lighting, and GPU](/knowledge/hardware-raider-input-lighting-gpu).
6. **Recovery and maintenance.** Troubleshooting cheatsheet, Btrfs snapshots, smoke tests: [Linux Troubleshooting and Recovery](/knowledge/linux-troubleshooting-recovery).
7. **Later: give Linux more space.** A plan to shrink Windows and add the freed space to the Btrfs filesystem with `btrfs device add`. It's at the end of the dual-boot article.

## Final layout

```text
UEFI firmware
├── Windows Boot Manager
└── Linux boot entry

NVMe SSD (~954 GiB)
├── EFI System Partition (300 MiB, shared)   -> /boot/efi in Arch
├── Microsoft Reserved (128 MiB)
├── Windows C: (~625 GiB, BitLocker)
├── Windows recovery (~900 MiB)
├── MSI/OEM recovery (~35 GiB)
└── Arch Btrfs (~293 GiB)
    ├── @      -> /
    └── @home  -> /home

KDE Plasma (Wayland)
├── SDDM login manager
├── NetworkManager + plasma-nm  (iwd backend)
├── PipeWire + WirePlumber
└── BlueZ + Bluedevil
```

In my home directory I keep project repos under `~/code/`, shared ML model weights under `~/models/`, and machine-management scripts, smoke tests and notes under `~/linux/`, so maintaining the machine stays separate from project code.

## Update log: what changed over time

After the install I kept an append-only log of incidents and changes. Here are the highlights:

- **2026-08-26:** Bluetooth working. The Intel BE200 hardware and firmware were fine. The service just wasn't enabled, and `bluez-utils` was missing.
- **Late Aug to early Sep 2026:** Found that the internal speakers showed up only as "Dummy Output". Built and iterated the custom `linux-raider` kernel (several package revisions).
- **2026-09-04:** Fixed a black screen at boot that had needed a manual `systemctl restart sddm` every boot for about ten days. Cause: Xorg auto-adding the NVIDIA GPU as a second screen. Also added Spotify (Flatpak) plus Netflix and Prime Video as Chrome app-mode launchers.
- **2026-09-14:** The laptop hard-froze after resuming from sleep while docked. I traced it to a deadlock in the NVIDIA driver and enabled the NVIDIA suspend/resume/hibernate services. Also wrote the plan for extending the Linux partition.
- **2026-09-18:** The freeze came back even with those services enabled. It turned out to be a known upstream NVIDIA open-driver bug, fixed in driver 615.71.09.
- **2026-09-21:** Refreshed `archlinux-keyring` after a roughly three-week gap, then ran `pacman -Su`, which upgraded `nvidia-open-dkms` from 610.57.04 to 615.71.09. `nvidia-smi` reported a "Driver/library version mismatch" until I rebooted. That's expected, because the old kernel module was still loaded. After the reboot the deadlock signature was gone.
- **2026-09-23:** Speakers disappeared after a lid-close/resume. The kernel hadn't changed. WirePlumber had lost the SoundWire codec. Fix: `systemctl --user restart wireplumber pipewire pipewire-pulse`. It happens on every resume, so an automatic resume hook is the durable fix.
- **2026-09-28:** Added camera apps (GNOME Snapshot and KDE Kamoso) as Flatpaks.
- **2026-10-01:** Two crashes turned out to be a KWin compositor freeze on a display hotplug event. They weren't caused by an update or by the old NVIDIA deadlock. Still under investigation.
- **2026-10-02:** "Webcam not working in Teams" turned out to be the wrong camera selected. The IR camera shows black in normal light. Selecting "FHD Webcam" fixed it.

## Key takeaways

- Arch wasn't randomly broken. Most of my early problems were pieces the minimal install never installed.
- Very new laptops can be ahead of Linux's per-model quirk tables, even on a bleeding-edge distro.
- Plan BitLocker, Secure Boot and VMD changes before you touch them. Don't toggle them blindly.
- Reuse the Windows EFI partition and never format it.
- Separate `@` and `@home` subvolumes make rolling back after a bad update practical.
- Use logs to find which layer is failing before reinstalling packages at random.
- Keep a dated log. Several later "is it broken again?" moments were answered in minutes by checking `pacman.log` and the previous boot's journal.
