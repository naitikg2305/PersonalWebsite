---
title: "Linux Troubleshooting and Recovery: USB Boot, arch-chroot, Bootloader, and Real Incidents"
category: "Linux: Commands & System Management"
slug: "linux-troubleshooting-recovery"
summary: "How I diagnose and recover a broken Arch Linux system, from finding the failing layer in the logs to rescuing an unbootable machine with a live USB and arch-chroot."
---

# Linux Troubleshooting and Recovery

I run Arch Linux with KDE Plasma as my main workstation. It's dual-booted with Windows on an MSI Raider 16 Max, which has an NVIDIA RTX 5070 Ti Laptop GPU. Most of the time it just works. When it doesn't, I follow one rule: **find the failing layer in the logs before reinstalling anything.** Nearly every "Arch is broken" moment I've had came down to one missing package, one disabled service, or one known driver bug. The OS itself was rarely the problem.

This page is my recovery runbook. It covers general diagnostics, rescuing a machine that won't boot, and the real incidents that taught me each lesson.

## Step 1: Find the failing layer

A Linux desktop is a stack of layers: firmware, bootloader, kernel, initramfs, systemd services, display manager, desktop shell, and apps. A black screen could be a problem in any of them. These are the commands I run first.

### Services and logs

```bash
systemctl --failed                          # any units that failed this boot
systemctl status SERVICE --no-pager         # state + last log lines of one service
systemctl --user status SERVICE --no-pager  # same, for per-user services
journalctl -b                               # everything logged since this boot
journalctl -b -p err                        # only errors from this boot
journalctl -u SERVICE -b --no-pager         # one service's log for this boot
journalctl -u NetworkManager -f             # follow a service log live
journalctl -k -b                            # kernel messages (like dmesg) for this boot
journalctl --list-boots                     # every recorded boot and when it ended
journalctl -b -1 -n 200                     # last 200 lines of the previous boot
```

### Hardware, drivers, and libraries

```bash
lsblk -f                              # disks, partitions, filesystems, mountpoints
lspci -k                              # PCI devices and which kernel driver is bound
lspci -nn | grep -Ei 'vmd|nvme|raid'  # storage-controller mode problems
ldd /path/to/binary | grep "not found"  # missing shared libraries
nmcli device status                   # network devices as NetworkManager sees them
wpctl status                          # PipeWire audio graph
```

### Did an update change anything?

```bash
grep -E 'upgraded|installed' /var/log/pacman.log | tail -30
```

## Step 2: Rescue a system that won't boot

If the machine won't reach a login screen, I boot the Arch install USB. Then I mount the installed system and `arch-chroot` into it, which gives me a root shell *inside* the broken install so I can run its own package manager and boot tools.

My layout is Btrfs with an `@` subvolume for `/` and `@home` for `/home`. It also reuses the existing Windows EFI System Partition, mounted at `/boot/efi`.

```bash
lsblk -f                                             # identify root and EFI partitions
mount -o subvol=@ /dev/nvme0n1pX /mnt                # mount root subvolume
mount --mkdir -o subvol=@home /dev/nvme0n1pX /mnt/home
mount --mkdir /dev/nvme0n1pY /mnt/boot/efi           # existing EFI partition, never format it
arch-chroot /mnt                                     # enter the installed system
```

Replace `pX` and `pY` with your own partitions. Inside the chroot, the usual fixes are:

```bash
cat /etc/fstab                     # check root/home/EFI entries (UUID=<UUID>) match lsblk -f
mkinitcpio -P                      # rebuild initramfs for every installed kernel
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB  # reinstall GRUB
grub-mkconfig -o /boot/grub/grub.cfg   # regenerate the GRUB menu
pacman -Syu                        # finish an interrupted or partial upgrade
exit
umount -R /mnt
reboot
```

### Kernel panic: "Unable to mount root fs"

The recovery pattern is: boot USB, mount `@`, mount `@home`, mount EFI, `arch-chroot`, check `fstab`, run `mkinitcpio -P`, then regenerate GRUB. A wrong root UUID or a missing initramfs is the usual cause.

### Machine boots straight into Windows

Press F11 (the MSI one-time boot menu) to check whether a GRUB entry still exists in firmware. If it's gone, Windows or a firmware update probably replaced it. Chroot in and run `grub-install` and `grub-mkconfig` as shown above. On MSI boards, Delete opens BIOS setup, F11 opens the boot menu, and F10 saves BIOS changes.

### Never format during dual boot

Leave the EFI System Partition, Microsoft Reserved partition, Windows NTFS partition, and recovery/OEM partitions alone. Arch can share the existing EFI partition without formatting it.

## Real incidents and their lessons

### "The laptop won't turn on." It was on the whole time.

After resuming from suspend while docked to external monitors, the screens stayed black and the power button seemed to do nothing. It looked like dead hardware. The first thing I checked after it came back was:

```bash
journalctl --list-boots
journalctl -b -2 -n 200
```

The "dead" boot's journal had no shutdown sequence. It just stopped, which means the machine was hung, not off. The tail of the log repeated this every two minutes:

```text
INFO: task kwin_wayland blocked for more than 122 seconds.
... blocked on a semaphore likely last held by task nvidia-modeset
```

The NVIDIA driver had deadlocked after s2idle resume. That froze the KDE Wayland compositor, so nothing could be drawn. First I enabled the NVIDIA sleep services, which DKMS installs don't enable for you:

```bash
sudo systemctl enable nvidia-suspend.service nvidia-resume.service nvidia-hibernate.service
```

The freeze came back with those services running, and the stack trace was identical. So I searched the driver's upstream issue tracker for the exact function names in the trace. It turned out to be a known Display Idle Frame Refresh (DIFR) prefetch deadlock in the open NVIDIA kernel modules, fixed in a newer driver release that had already reached the Arch repos. The real fix was a **full** system upgrade, not a driver-only partial upgrade:

```bash
sudo pacman -Sy archlinux-keyring   # refresh signing keys first if the keyring is stale
sudo pacman -Su                     # full upgrade (DKMS rebuilds the NVIDIA module)
pacman -Q nvidia-open-dkms && dkms status
nvidia-smi                          # after reboot, confirm the driver loads
```

Until then, my workaround was to avoid suspending while docked and turn off KDE's automatic screen blanking.

**Lessons:** black screens don't mean the machine is off, so check `journalctl --list-boots`. If a "fixed" bug comes back unchanged, search upstream for the stack-trace function names before adding more local config. And actually run the upgrade you planned: it recurred a third time because I hadn't.

### SDDM login screen crashes with exit code 127

After I switched desktop sessions, the graphical login failed and dropped to a text screen. I pressed `Ctrl+Alt+F3` to get a TTY, then:

```bash
systemctl status sddm --no-pager             # greeter exited with status 127
ldd /usr/bin/sddm-greeter | grep "not found" # showed missing Qt5 libraries
sudo pacman -S --needed qt5-base qt5-declarative
sudo systemctl restart sddm
```

Exit code 127 usually means "command or library not found". `ldd` points straight at what's missing.

### Wi-Fi keeps connecting and disconnecting

```bash
nmcli monitor
journalctl -u NetworkManager -f
```

The log showed `supplicant-timeout`. I switched NetworkManager's Wi-Fi backend from wpa_supplicant to iwd by creating `/etc/NetworkManager/conf.d/wifi_backend.conf`:

```ini
[device]
wifi.backend=iwd
wifi.iwd.autoconnect=false
```

```bash
sudo systemctl restart NetworkManager
ps aux | grep -E 'iwd|wpa_supplicant'   # confirm iwd is the one running
iw dev wlan0 link                       # check negotiated link rate if speed looks capped
```

One time the link rate looked capped at about 130 Mbps. It recovered to gigabit-class speeds on its own, so I learned not to undo a working config change without evidence.

### Audio shows only "Dummy Output"

```bash
wpctl status
aplay -l
arecord -l
lspci -k | grep -A4 -Ei 'audio|multimedia'
journalctl -k -b | grep -i soundwire
```

On this laptop the Intel SOF driver and firmware loaded fine, but the kernel logged `No SoundWire machine driver found`. Very new hardware can be ahead of the kernel's per-model quirk tables. That's an upstream kernel issue, not a PipeWire setting, and no amount of GUI tweaking fixes it.

### Installer can't see the internal SSD

`lsblk` showed only the USB stick. Intel VMD (a RAID/Optane storage controller mode) was hiding the NVMe drive. Turning VMD off without breaking Windows took a planned sequence: suspend BitLocker, force Windows Safe Mode for the next boot, disable VMD in BIOS, boot Safe Mode once, remove the safeboot flag, reboot normally, and then boot the Arch USB.

### Small "command not found" errors on a minimal install

```bash
sudo pacman -S nano                  # nano: command not found
sudo pacman -S openssh               # ssh-keygen: command not found
sudo pacman -S --needed base-devel git   # prerequisites before building yay
```

### A CLI tool reinstall left a broken placeholder

A globally installed npm CLI started failing with "native binary not installed". npm's `allow-scripts` policy was blocking the package's postinstall step, so only a tiny stub got installed, and every auto-update put the stub back. Running the postinstall by hand fixed it once. Allowing that one package's script in user-level npm config fixed it for good. I also learned that a running process survives even after its binary is deleted (`/proc/<pid>/exe` shows `(deleted)`). **Fix a broken CLI before you close the last working session.**

## Key takeaways

- Arch is rarely "randomly broken". Look for a missing package, a disabled service, or a known upstream bug.
- Find the failing layer with `systemctl --failed`, `journalctl -b`, `ldd`, and `lspci -k` before reinstalling anything.
- A live USB plus `arch-chroot` can fix almost any boot failure: fstab, initramfs (`mkinitcpio -P`), GRUB.
- Never format the shared EFI partition or Windows partitions in a dual-boot setup.
- Black screen doesn't mean powered off. `journalctl --list-boots` tells you which.
- Always do full upgrades (`pacman -Syu`), never partial ones.
- A separate Btrfs `@` and `@home` makes rollbacks practical. See [Snapshots and smoke tests](/knowledge/linux-snapshots-and-smoke-tests).
