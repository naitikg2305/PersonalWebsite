---
title: "Building a Custom Arch Linux Kernel Package That Coexists with Stock"
category: "Linux: Hardware & Custom Kernel"
slug: "hardware-building-arch-kernel-packages"
summary: "A practical walkthrough of how I package a patched Linux kernel on Arch (PKGBUILD, config, makepkg, headers, mkinitcpio UKI, systemd-boot one-shot testing) so it installs next to the stock kernel and can be rolled back safely."
---

# Building a custom Arch kernel package that coexists with stock

I needed two small kernel patches to get [the internal speakers working on my MSI Raider 16 Max](/knowledge/hardware-raider-custom-kernel-audio). I didn't want to patch a source tree and run `make install`. I built a proper pacman package, **`linux-raider`**, from Arch's official kernel recipe. It installs next to the stock `linux` package, has its own headers package for DKMS, and gets its own boot entry. This is the general method. The Raider specifics are only examples.

## 1. Start from the official Arch recipe

```bash
git clone https://gitlab.archlinux.org/archlinux/packaging/packages/linux.git linux-raider-audio
cd linux-raider-audio
```

This gives you Arch's `PKGBUILD`, `config.x86_64`, and the signature and checksum metadata. Starting from it means your kernel matches stock in everything except your patches.

## 2. Rename the package base

The most important edit is the first line:

```bash
pkgbase=linux-raider      # was: pkgbase=linux
pkgver=7.1.10.arch1
pkgrel=6                  # bump for every rebuild
```

Arch's `prepare()` already turns the package name into the kernel's local version:

```bash
echo "-$pkgrel" > localversion.10-pkgrel
echo "${pkgbase#linux}" > localversion.20-pkgname
```

So `pkgbase=linux-raider`, `pkgrel=6` produces the kernel release `7.1.10-arch1-6-raider`. The modules go into their own `/usr/lib/modules/7.1.10-arch1-6-raider/` directory, and the `pkgbase` file there tells mkinitcpio what to call the image. Nothing overlaps with stock. The config itself keeps `CONFIG_LOCALVERSION=""` with `CONFIG_LOCALVERSION_AUTO=y`, and all the naming comes from those `localversion.*` files.

The PKGBUILD's `pkgname=("$pkgbase" "$pkgbase-headers")` loop then gives you two packages, `linux-raider` and `linux-raider-headers`. I left out the docs package.

## 3. Add patches to `source=()`

```bash
source=(
  https://cdn.kernel.org/pub/linux/kernel/v${pkgver%%.*}.x/${_srcname}.tar.{xz,sign}
  $url/releases/download/$_srctag/linux-$_srctag.patch.zst{,.sig}
  0001-asoc-intel-arl-add-rt713-l0-rt1320-l2.patch
  0002-asoc-intel-sof_sdw-force-append_dai_type-msi-raider.patch
)
```

You don't need to change `prepare()`. It already loops over every `*.patch` in `source` and applies them in order with `patch -Np1`. Add a matching `SKIP` (or a real hash) to each checksum array for every local file you add. Upstream tarballs keep their PGP signatures, which `makepkg` verifies against the kernel maintainers' keys listed in `validpgpkeys`. Import those keys before your first build.

## 4. The config

I kept Arch's `config.x86_64` unchanged. `prepare()` copies it to `.config` and runs `make olddefconfig`. The options my fix depends on are already modules in the stock config, so I only needed code changes, for example:

```text
CONFIG_SOUNDWIRE_INTEL=m
CONFIG_SND_SOC_SOF_INTEL_SOUNDWIRE=m
CONFIG_SND_SOC_INTEL_SOUNDWIRE_SOF_MACH=m
CONFIG_SND_SOC_RT1320_SDW=m
CONFIG_SND_SOC_RT712_SDCA_SDW=m
CONFIG_DYNAMIC_DEBUG=y      # essential for tracing the driver live
```

To check what's set, grep the config instead of opening it: `grep -E 'SND_SOC_SOF|SOUNDWIRE' config.x86_64`. It's almost 300 KB.

## 5. Build

```bash
sudo pacman -S --needed bc pahole rust rust-bindgen rust-src   # plus the PKGBUILD makedepends
makepkg --nobuild --cleanbuild                                  # fetch, verify, patch, configure
MAKEFLAGS=-j24 makepkg --noextract --nocheck --noconfirm        # compile and package
```

Running it in two steps lets you check that the patches applied before you spend time on the compile. For later rebuilds, `makepkg --cleanbuild --syncdeps` does everything in one go.

**Gotcha: Kbuild rejects source paths that contain spaces.** My notes folder has spaces in its name, so I build in a no-space directory (`~/linux-raider-build`, a Btrfs reflink copy so it takes no extra space) and keep the canonical PKGBUILD and patches in my runbook.

Before installing, I look inside the package to check that it really contains the patched modules. The file name alone tells you nothing.

## 6. Install kernel and headers

```bash
sudo pacman -U linux-raider-7.1.10.arch1-6-x86_64.pkg.tar.zst \
               linux-raider-headers-7.1.10.arch1-6-x86_64.pkg.tar.zst
```

Always install the headers. DKMS needs them to rebuild out-of-tree modules for your kernel. On my laptop the pacman hooks rebuilt NVIDIA's `nvidia-open-dkms` module for the new kernel release automatically.

## 7. Initramfs / UKI and the bootloader

My laptop boots **unified kernel images (UKIs)** with **systemd-boot**, which finds any `.efi` in `EFI/Linux/` on its own, so no loader entry file is needed. I added a dedicated mkinitcpio preset:

```bash
# /etc/mkinitcpio.d/linux-raider.preset
ALL_kver="/boot/vmlinuz-linux-raider"
PRESETS=('default')
default_config="/etc/mkinitcpio-raider.conf"
default_uki="/boot/efi/EFI/Linux/arch-linux-raider.efi"
default_options="--splash /usr/share/systemd/bootctl/splash-arch.bmp"
```

**Gotcha: EFI partition space.** My EFI system partition is only 296 MiB, and the stock UKI is about 147 MiB because the `kms` hook pulls in large NVIDIA firmware. A second UKI of the same size wouldn't fit, and mkinitcpio failed cleanly and left the stock image alone. The fix was a minimal config for the custom kernel that drops the optional early-KMS hook:

```bash
# /etc/mkinitcpio-raider.conf
HOOKS=(base udev autodetect microcode modconf keyboard keymap consolefont block filesystems fsck)
COMPRESSION="zstd"
```

Graphics drivers still load normally once the root filesystem is mounted. That brought the custom UKI down to about 29 MiB.

```bash
sudo install -Dm644 mkinitcpio-raider.conf /etc/mkinitcpio-raider.conf
sudo install -Dm644 linux-raider.preset /etc/mkinitcpio.d/linux-raider.preset
sudo mkinitcpio -p linux-raider
```

## 8. Test with a one-shot boot, keep stock as the fallback

```bash
sudo bootctl set-oneshot arch-linux-raider.efi
sudo reboot
# after boot
uname -r                    # expect 7.1.10-arch1-6-raider
```

A one-shot entry only applies to the next boot. If the new kernel fails, the following reboot goes back to the default entry, or you can pick stock from the systemd-boot menu. **Never remove the stock `linux` package or its UKI.** Once the custom kernel has proven itself, you can make it the default.

## Maintaining it

- **It won't auto-update.** pacman treats `linux-raider` as a locally built package, so a `pacman -Syu` that upgrades stock `linux` leaves it alone. That's useful: an update can't silently replace my working kernel. My update log confirms this. Every kernel change shows up as a deliberate local build.
- **To move to a newer kernel:** pull the new Arch recipe, bump `pkgver` and reset `pkgrel`, re-add the patches and rebase them if they no longer apply, rebuild, reinstall kernel and headers, regenerate the UKI, and repeat the one-shot test.
- **Keep a revision ledger.** I log what each `pkgrel` changed and whether it actually passed a boot test. With several builds of one kernel version, this is the only way I know which artifact is which.
- **Retire it** once upstream merges equivalent support, and go back to stock.

## Key takeaways

- Renaming `pkgbase` is enough to get a separate kernel release, module directory, and package that sit next to stock without conflict.
- Arch's `prepare()` applies every `*.patch` in `source=()` automatically, so adding a patch is a one-line change plus a checksum entry.
- Always build and install the matching `-headers` package, or DKMS modules such as NVIDIA's won't build.
- Watch the environment: no spaces in the build path, and enough room on the EFI partition for a second UKI.
- Test with `bootctl set-oneshot` and keep the stock kernel installed as your way back.
