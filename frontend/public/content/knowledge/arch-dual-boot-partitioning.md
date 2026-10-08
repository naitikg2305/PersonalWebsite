---
title: "Dual Boot Prep on the MSI Raider 16 Max: BIOS, BitLocker, VMD, and Partitioning"
category: "Linux: My Arch Install (MSI Raider 16 Max)"
slug: "arch-dual-boot-partitioning"
summary: "How I prepared a Windows laptop for an Arch Linux dual boot: suspending BitLocker, disabling Intel VMD through MSI's hidden BIOS menu without breaking Windows, freeing disk space (including the offline GParted shrink), and the later plan to give Linux more space with btrfs device add."
---

# Dual Boot Prep on the MSI Raider 16 Max: BIOS, BitLocker, VMD, and Partitioning

## Why this step matters

Before installing Arch next to Windows, three things have to be true:

1. There's **unallocated space** on the disk for Linux.
2. The Linux installer can **see the internal SSD**.
3. Windows **still boots** afterwards, without asking for a BitLocker recovery key and without an "inaccessible boot device" crash.

On my MSI Raider 16 Max the hard part was points 2 and 3, because of modern firmware security features. I'm also including the disk-shrinking lessons from an earlier install attempt on an Acer Predator Triton 300 SE, because they're the reason I knew how to handle a Windows shrink that refuses to cooperate.

Useful MSI keys:

```text
Delete -> BIOS/UEFI setup
F11    -> one-time boot menu
F10    -> Save & Exit in BIOS
```

## Step 1: Check and suspend BitLocker

When I turned off Secure Boot, Windows asked for the BitLocker recovery key on its next boot. That's expected: BitLocker measures the boot environment, and firmware changes look suspicious to it. Before changing any BIOS storage or security settings, check BitLocker from an elevated PowerShell:

```powershell
manage-bde -status C:
```

If protection is on, suspend it:

```powershell
manage-bde -protectors -disable C:
```

Once Windows boots normally again after all the changes, re-enable it:

```powershell
manage-bde -protectors -enable C:
```

I turned Secure Boot off to keep the Arch install simple.

## Step 2: Intel VMD hid the NVMe from Linux

When I first booted the Arch USB, the installer saw only `/dev/sda`, which was the USB stick itself. The internal NVMe was missing. `lspci` showed an **Intel VMD** controller, and the MSI BIOS confirmed VMD was enabled. VMD (part of Intel RST) puts the NVMe behind a RAID-style controller that the Arch installer couldn't see through.

The catch is that Windows had been installed with VMD on. If you disable VMD without preparing Windows, Windows can fail with an inaccessible boot device error, because it boots without the storage driver it needs. The safe way is to force one Safe Mode boot so Windows re-detects its storage controller.

In an elevated Windows shell, set the next boot to Safe Mode:

```powershell
cmd.exe /c "bcdedit /set {current} safeboot minimal"
```

Confirm BitLocker is suspended (Step 1), then reboot into the BIOS.

### MSI's hidden advanced menu

On this MSI generation the normal VMD option was greyed out. MSI's hidden advanced BIOS menu exposed a configurable version:

```text
Advanced
-> System Agent (SA) Configuration
-> VMD Controller
-> Disabled
```

I changed **only** that setting. The hidden menus contain many options that can destabilize the machine.

### Bringing Windows back

With VMD disabled, Windows came up in Safe Mode because of the BCDEdit flag. I then removed the flag:

```powershell
cmd.exe /c "bcdedit /deletevalue {current} safeboot"
```

and rebooted Windows normally, with VMD still off. After that, the Arch live USB could see the NVMe directly.

The whole sequence:

```text
Suspend BitLocker
-> force one Windows Safe Mode boot
-> disable Intel VMD in the BIOS
-> boot into Windows Safe Mode
-> remove the safeboot flag
-> verify a normal Windows boot
-> boot the Arch USB
```

## Step 3: Free space for Linux

The goal was roughly 250 to 300 GiB of unallocated space after the Windows partition, with the EFI, Microsoft Reserved and recovery partitions left alone. The Raider ended up with about 293 GiB for Arch.

### Lesson from the earlier attempt: when Windows won't shrink

On the earlier Acer attempt, Windows Disk Management offered only about 3 GiB of shrink space, even though C: had hundreds of GiB free. I tried the usual fixes inside Windows:

```powershell
powercfg /h off
```

I disabled the pagefile (System Properties -> Advanced -> Performance -> Settings -> Advanced -> Virtual memory -> No paging file) and System Protection (restore points), rebooted, then consolidated free space:

```powershell
defrag C: /X /V
```

It still wouldn't shrink. The real answer was in **Event Viewer's** shrink analysis:

```text
The last unmovable file appears to be: \$Mft::$BITMAP
```

That's NTFS Master File Table metadata, and Windows can't move it while C: is mounted. More defragging was never going to help.

**Fix: resize offline with GParted Live.** I wrote the GParted ISO to a USB with Rufus. The first boot failed because of how the USB had been written. Rewriting it in Rufus's **DD Image mode** fixed it. Then:

- Boot **GParted Live (Default settings)**, keep the default keymap, choose graphical mode `0`.
- Select the Windows NTFS partition and shrink it **from the right only**: "Free space preceding" stays at `0 MiB`, and the new space goes *after* the partition (for exactly 280 GiB, enter `286720 MiB`).
- Leave the result **unallocated**. Don't create an NTFS or Linux partition there; the Arch installer does that.
- Never move the left edge of C:, and never touch the EFI, MSR or recovery partitions.
- Apply the queued operation.

My later notes record that the `$MFT` problem did **not** come up on the Raider itself. The prep that really mattered there was BitLocker and VMD.

## The resulting Raider layout

Verified with `lsblk` (physical order on disk):

```text
p1   300M    vfat       EFI System Partition (shared)  - DO NOT TOUCH
p2   128M    MSR        Microsoft Reserved             - DO NOT TOUCH
p3   624.8G  BitLocker  Windows C:
p4   900M    ntfs       Windows recovery               - DO NOT TOUCH
p5   34.8G   ntfs       MSI/OEM recovery               - DO NOT TOUCH
p6   293G    btrfs      Arch (@ -> /, @home -> /home)
```

The Linux partition sits at the **end** of the disk, after the two recovery partitions. That detail matters for the next section.

## Later: giving Linux more space from Windows

By September 2026 Windows was mostly empty and Linux needed room. I wrote a plan (not yet run at the time of writing) to move space from C: to Arch **without moving any partitions**.

### Why not just extend the Linux partition?

Shrinking C: leaves free space right after p3, but the Btrfs partition is at the end with p4 and p5 in between, so it can't simply grow into the gap. I considered two options:

- **Option A (chosen):** create a new partition in the gap and run `btrfs device add` to add it to the existing filesystem. Btrfs can span several partitions as one filesystem. No data moves, no live USB, and it's done online in minutes. Both partitions are on the same NVMe, so there's no extra hardware failure risk.
- **Option B (rejected):** use GParted to move p4, p5 and the start of p6 to the left. That rewrites hundreds of GB offline and takes hours, and moving a partition's start is the riskiest partition operation there is.

### The steps

1. **Take a Btrfs snapshot first.**
2. **Shrink C: from inside Windows.** C: is BitLocker-encrypted, so Linux tools can't resize it, but Disk Management can (Disk Management -> right-click C: -> Shrink Volume). Leave the space unallocated.
3. **Back in Arch, check the gap and create a partition:**

```bash
sudo parted /dev/nvme0n1 unit GiB print free
```

```bash
sudo fdisk /dev/nvme0n1
```

```text
n     (new partition; accept the offered start/end for the free gap)
t     (type) -> 23 (Linux root x86-64) or 20 (Linux filesystem)
w
```

Don't run `mkfs` on it. `btrfs device add` claims it.

4. **Add it to the root filesystem:**

```bash
sudo btrfs device add /dev/nvme0n1pX /
```

```bash
sudo btrfs filesystem usage /
```

```bash
df -h / /home
```

Because `@` and `@home` are subvolumes of the same filesystem, both get the new space straight away. Running `sudo btrfs balance start -dusage=50 /` to spread existing data is optional.

5. **Check that boot config is still fine.** A multi-device Btrfs filesystem is found by its filesystem UUID, which doesn't change on device add, so `/etc/fstab` entries like `UUID=<UUID>` keep working. Only if the initramfs ever fails to assemble the filesystem should `btrfs` be added to `MODULES` in the mkinitcpio configs, followed by `sudo mkinitcpio -P`.

**Caveat:** once root spans two partitions, removing either one later needs `btrfs device remove` first, which migrates the data off. Never just delete the partition.

## Key takeaways

- Suspend BitLocker **before** touching Secure Boot, VMD or any other storage or security firmware setting.
- If the Linux installer sees only the USB stick, check for Intel VMD. Disable it through a forced Safe Mode boot so Windows survives.
- When Disk Management won't shrink and Event Viewer points at `$Mft::$BITMAP`, stop defragging and resize offline with GParted, shrinking from the right only.
- Leave the Linux space unallocated, and never format the EFI, MSR or recovery partitions.
- With Btrfs, adding a partition with `btrfs device add` is far safer than moving partitions around to grow one.
