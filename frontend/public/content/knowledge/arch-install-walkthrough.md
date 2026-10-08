---
title: "Installing Arch Linux with archinstall: Btrfs, a Shared EFI Partition, and Dual Boot"
category: "Linux: My Arch Install (MSI Raider 16 Max)"
slug: "arch-install-walkthrough"
summary: "How I installed Arch Linux next to Windows on my MSI Raider 16 Max with archinstall: live-USB networking, manual partitioning, Btrfs @ and @home subvolumes, reusing the Windows EFI partition without formatting it, boot order, and the chroot repair procedure for when the bootloader or root mount breaks."
---

# Installing Arch Linux with archinstall: Btrfs, a Shared EFI Partition, and Dual Boot

## What this covers

This is the actual Arch install on my MSI Raider 16 Max, after the Windows and BIOS prep in [Dual Boot Prep](/knowledge/arch-dual-boot-partitioning) had left unallocated space and the NVMe was visible to Linux. I used Arch's guided installer, `archinstall`, rather than a fully manual install, and partitioned by hand so Windows stayed untouched.

I'm also including the bootloader repair and kernel-panic recovery from an earlier attempt on an Acer laptop. The Raider didn't need them, but they're the procedures I'd reach for if a dual boot ever stops booting.

## Step 1: Get the right ISO and boot it in UEFI mode

Use the official **x86_64 Arch Linux install ISO**, not the bootstrap tarball, which is a different download on the same page. Write it to a USB stick, press **F11** on the MSI for the one-time boot menu, and pick:

```text
Arch Linux install medium (x86_64, UEFI)
```

UEFI mode matters: Windows boots via UEFI, so Linux has to as well to share the same EFI System Partition.

## Step 2: Get online in the live environment

Ethernet just works. For Wi-Fi, the live ISO includes `iwd`:

```bash
iwctl
```

Then, inside the iwd shell, one command at a time:

```text
device list
station wlan0 scan
station wlan0 get-networks
station wlan0 connect "YOUR_SSID"
exit
```

Check the connection:

```bash
ping -c 3 archlinux.org
```

## Step 3: Run archinstall

```bash
archinstall
```

The installer is menu-driven. Most of the choices are simple. The disk configuration is the one that can destroy a dual boot.

### Disk configuration: manual partitioning only

**Never pick "wipe disk" or "use entire disk" on a dual-boot machine.** That deletes Windows. Choose **manual partitioning**, then:

1. Select the large **free space** left by the Windows shrink (about 293 GiB on the Raider) and create one partition from it.
2. Format that partition as **btrfs**.
3. Create two Btrfs subvolumes:

```text
@      -> /
@home  -> /home
```

4. Select the **existing FAT32 EFI System Partition** (300 MiB on the Raider), set its mount point to `/boot/efi`, and make sure **format is OFF**. Windows Boot Manager lives on that partition.

The partition summary before installing looked roughly like this:

```text
EFI System Partition   300 MiB  FAT32   -> /boot/efi   (existing, NOT formatted)
Microsoft Reserved     128 MiB          (untouched)
Windows                ~625 GiB NTFS    (untouched)
Arch                   ~293 GiB Btrfs   -> @ = /, @home = /home   (new)
Windows recovery       ~900 MiB NTFS    (untouched)
MSI/OEM recovery       ~35 GiB  NTFS    (untouched)
```

### Why Btrfs rather than ext4

- **Subvolumes:** root and home are separate logical filesystems on the same partition and share its free space.
- **Snapshots:** copy-on-write snapshots are almost instant and cost very little space at first.
- **Rollback:** if an Arch update breaks something, I can roll back `@` (the OS) without touching `@home` (my code, SSH keys, models and configs).

On a rolling-release distro that I update regularly, that safety net was the deciding factor. Snapshot tooling and the restore workflow are in [Linux Troubleshooting and Recovery](/knowledge/linux-troubleshooting-recovery).

### The rest of my archinstall choices

```text
Disk configuration: Manual partitioning
Filesystem:         Btrfs (@ -> /, @home -> /home)
EFI:                existing FAT32 ESP at /boot/efi, format = NO
Bootloader:         GRUB (see the note below)
Profile:            Desktop -> KDE Plasma
Audio:              PipeWire
Network:            NetworkManager
Kernel:             linux (linux-lts optional as a fallback)
User:               a normal user with sudo
```

When the installer finished, I chose **Reboot system** and pulled out the USB during the reboot.

### A note on the bootloader

My install checklist says GRUB, which is what I used on the earlier Acer attempt and what the repair procedure below is written for. On the Raider, my later system notes describe the stock kernel booting as a **unified kernel image (UKI)**, `arch-linux.efi`, stored in `/boot/efi/EFI/Linux/` and loaded by **systemd-boot**. I've written both down so this guide stays faithful to my notes. If you follow along, check which bootloader you actually end up with (`bootctl status` or `efibootmgr`), because snapshot tools like grub-btrfs only make sense with GRUB.

The shared EFI partition also turned out to be a real constraint. At 300 MiB, it couldn't hold a second ~150 MiB UKI when I later added a custom kernel. That story is in [Custom Kernel and Speaker Audio](/knowledge/hardware-raider-custom-kernel-audio).

## Step 4: Boot order

The aim is a boot menu that offers both systems. In the MSI BIOS (**Delete**), put the Linux boot entry ahead of Windows Boot Manager:

```text
1. Linux boot entry (GRUB / systemd-boot)
2. Windows Boot Manager
```

**F11** still works as a one-time override whenever I want to go straight into Windows.

## What went wrong on the earlier attempt, and how I fixed it

### "It boots straight into Windows"

On the Acer, Arch installed but the firmware only showed Windows Boot Manager. No Linux entry had been registered. The fix was to boot the Arch USB, mount the installed system, chroot in, and reinstall GRUB.

Find the partitions:

```bash
lsblk -f
```

Mount the Btrfs top level and confirm the subvolumes exist (the partition numbers here are from that machine):

```bash
mount /dev/nvme0n1p5 /mnt
btrfs subvolume list /mnt
umount /mnt
```

Mount the real layout, subvolumes and EFI included:

```bash
mount -o subvol=@ /dev/nvme0n1p5 /mnt
mount --mkdir -o subvol=@home /dev/nvme0n1p5 /mnt/home
mount --mkdir /dev/nvme0n1p1 /mnt/boot/efi
arch-chroot /mnt
```

Install the bootloader tools:

```bash
pacman -S grub efibootmgr os-prober
```

DNS failed inside the chroot. The fix was to exit and copy the live ISO's resolver config in, then go back in:

```bash
exit
cp -L /etc/resolv.conf /mnt/etc/resolv.conf
arch-chroot /mnt
```

Install GRUB to the ESP, enable Windows detection, and generate the config:

```bash
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB
echo 'GRUB_DISABLE_OS_PROBER=false' >> /etc/default/grub
grub-mkconfig -o /boot/grub/grub.cfg
efibootmgr
```

`GRUB_DISABLE_OS_PROBER=false` is what makes GRUB add a Windows entry. Recent GRUB versions turn os-prober off by default.

### Kernel panic: "Unable to mount root fs"

The Acer later failed with:

```text
VFS: Unable to mount root fs on unknown-block(0,0)
```

The recovery pattern is the same chroot as above, then check the three places that define how root gets mounted:

```bash
cat /etc/fstab
ls -lh /boot
mkinitcpio -P
grub-mkconfig -o /boot/grub/grub.cfg
```

That means checking that fstab points at the right filesystem UUID and subvolumes, that the kernel and initramfs actually exist in `/boot`, and that the bootloader's `root=` line matches. Then rebuild the initramfs and regenerate the bootloader config.

The Raider install didn't go down either failure path. Its problems came after first boot, in the desktop, networking and audio layers.

## After first boot: small things the minimal install left out

A few everyday tools weren't there on the fresh system:

```bash
sudo pacman -S nano
sudo pacman -S openssh
sudo pacman -S --needed base-devel git
```

`nano: command not found` and `ssh-keygen: command not found` are simply missing packages. `base-devel` and `git` are needed before building the `yay` AUR helper.

## Key takeaways

- Use the official ISO and boot it in **UEFI** mode so Linux can share Windows' EFI partition.
- In archinstall, **manual partitioning** is the only safe choice for a dual boot. Never "wipe disk".
- Reuse the existing ESP at `/boot/efi` and **never format it**.
- Btrfs with separate `@` and `@home` subvolumes lets you roll back the OS without losing your files.
- Keep the chroot repair sequence handy: mount `@`, `@home` and the ESP, `arch-chroot`, then reinstall or regenerate the bootloader.
- A small (300 MiB) shared ESP limits how many kernel images you can store on it later.
