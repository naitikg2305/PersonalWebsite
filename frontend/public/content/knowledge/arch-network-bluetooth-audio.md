---
title: "Wi-Fi, Bluetooth, and Audio on Arch: NetworkManager with iwd, BlueZ, and PipeWire"
category: "Linux: My Arch Install (MSI Raider 16 Max)"
slug: "arch-network-bluetooth-audio"
summary: "How I got Wi-Fi, Bluetooth and audio working on Arch on my MSI Raider 16 Max: fixing Wi-Fi authentication timeouts by switching NetworkManager to the iwd backend, enabling the Intel BE200 Bluetooth, and tracing missing internal speakers through PipeWire and ALSA down to a kernel machine-driver gap."
---

# Wi-Fi, Bluetooth, and Audio on Arch: NetworkManager with iwd, BlueZ, and PipeWire

## Overview

The Raider's wireless card is an **Intel Wi-Fi 7 BE200** (Wi-Fi and Bluetooth on one card), and its audio uses a newer **SoundWire** layout. All three subsystems needed work after the install. Wi-Fi and Bluetooth turned out to be configuration problems. Audio turned out to be a kernel problem, and I found that out by checking one layer at a time instead of reinstalling packages at random.

---

## Part A: Wi-Fi

### Step 1: Give KDE a real network manager

During the install, Wi-Fi was brought up from the live environment, but the desktop had no proper network GUI. I installed and enabled the standard stack:

```bash
sudo pacman -S --needed networkmanager plasma-nm
sudo systemctl enable --now NetworkManager
nmcli device status
systemctl is-active NetworkManager
```

A healthy result shows `wlan0  wifi  connected  <network name>` and `active`.

### Step 2: The connection kept flapping

Then Wi-Fi started cycling between `activating` and `deactivating`, and KDE showed authentication errors. Two tools narrowed it down:

```bash
nmcli monitor
journalctl -u NetworkManager -f
```

The log said:

```text
reason 'supplicant-timeout'
Activation failed for connection '<network name>'
```

That pointed at the **wpa_supplicant authentication layer**, not DNS, DHCP or KDE.

### Step 3: Switch NetworkManager's backend to iwd

NetworkManager can use **iwd** (Intel's newer wireless daemon) instead of wpa_supplicant. I installed it and wrote the config in one command:

```bash
sudo pacman -S iwd
sudo mkdir -p /etc/NetworkManager/conf.d
printf '[device]\nwifi.backend=iwd\nwifi.iwd.autoconnect=false\n' | sudo tee /etc/NetworkManager/conf.d/wifi_backend.conf
```

Result:

```ini
[device]
wifi.backend=iwd
wifi.iwd.autoconnect=false
```

`wifi.iwd.autoconnect=false` keeps **NetworkManager** in charge of when to connect, with iwd doing the work underneath. Then I stopped wpa_supplicant from competing:

```bash
sudo systemctl stop wpa_supplicant.service
sudo systemctl disable wpa_supplicant.service
sudo systemctl mask wpa_supplicant.service
sudo systemctl restart NetworkManager
```

(Masking is only needed if it keeps coming back.) After reconnecting through KDE, I checked which daemon was running:

```bash
ps aux | grep -E 'iwd|wpa_supplicant'
```

The goal is to see `/usr/lib/iwd/iwd` and no real `wpa_supplicant` process, apart from the grep itself. The final stack:

```text
KDE plasma-nm -> NetworkManager -> iwd -> Wi-Fi hardware
```

### A temporary speed cap

Right after the switch, throughput looked capped at about 130 Mbps. Later it went back to gigabit-class speeds without any further config change. If it happens again, these show the band, channel, negotiated rate and signal:

```bash
iw dev wlan0 link
nmcli -f IN-USE,SSID,BSSID,FREQ,CHAN,RATE,SIGNAL,SECURITY device wifi list
lspci -k | grep -A3 -Ei 'network|wireless'
```

Things to check: 2.4 GHz vs 5/6 GHz, signal strength, power saving, and whether the link renegotiated.

---

## Part B: Bluetooth

### What was wrong

Nothing at the hardware level. The kernel modules (`bluetooth`, `btusb`, `btintel`) and the Intel firmware from `linux-firmware-intel` were already loading cleanly. The Bluetooth **service was disabled**, and the `bluez-utils` command-line tools weren't installed.

### The fix

The KDE Bluetooth stack is BlueZ (the daemon) plus `bluez-utils` (the CLI) plus Bluedevil (KDE integration):

```bash
sudo pacman -S --needed bluez bluez-utils bluedevil usbutils
sudo systemctl enable --now bluetooth.service
```

Verify:

```bash
systemctl status bluetooth --no-pager
rfkill list bluetooth
bluetoothctl show
```

I expected to see the service enabled and running, the controller powered on, no soft or hard rfkill block, and `Pairable: yes`. `lsusb` identified the controller as **Intel Corp. BE200 Bluetooth**. An eight-second scan found plenty of nearby devices, and PipeWire registered a wide range of Bluetooth audio codecs (SBC, AAC, aptX/aptX HD/aptX LL, LDAC, Opus, FastStream). The codec actually used depends on what the headphones support.

Pairing is easiest in **System Settings -> Bluetooth** or from the tray icon. From the command line:

```bash
bluetoothctl
power on
agent on
default-agent
scan on
```

Then run `pair`, `trust` and `connect` with the device's address, followed by `scan off`.

**Practical notes:** pairing many devices isn't the same as streaming to all of them. A keyboard, mouse, controller and one headset at the same time is fine. Using a headset's microphone drops playback quality, because the headset switches from the A2DP profile to a two-way headset profile. That's a Bluetooth limitation, not a hardware one. Wi-Fi and Bluetooth share 2.4 GHz, so 5/6 GHz Wi-Fi reduces interference.

I didn't install any third-party or Windows-derived drivers. The in-kernel Intel driver plus up-to-date `linux-firmware-intel` is the right path, kept current with `sudo pacman -Syu`.

---

## Part C: Audio

### The intended stack

```text
Kernel driver (Intel SOF + SoundWire)
-> ALSA
-> PipeWire
-> WirePlumber
-> KDE audio controls
```

```bash
sudo pacman -S pipewire pipewire-pulse wireplumber alsa-utils
sudo pacman -S sof-firmware
sudo pacman -S alsa-ucm-conf
```

### The symptom: "Dummy Output"

`wpctl status` listed the audio controller, but the only sink was **Dummy Output** and there were no sources. PipeWire and WirePlumber were running. ALSA showed only HDMI outputs (NVIDIA and Intel), and `arecord -l` listed no capture devices. `lspci -k` showed the Intel SOF driver (`sof-audio-pci-intel-mtl`) bound correctly.

### Finding the failing layer

As a normal user, `dmesg` returned "Operation not permitted", so I read the kernel log through journald instead:

```bash
journalctl -b | grep -Ei 'sof|snd|soundwire|audio|codec' | tail -120
```

The key lines:

```text
No SoundWire machine driver found for the ACPI-reported configuration:
link 0 mfg_id 0x025d part_id 0x0713 version 0x3
link 2 mfg_id 0x025d part_id 0x1320 version 0x3
link 2 mfg_id 0x025d part_id 0x1320 version 0x3
using HDA machine driver skl_hda_dsp_generic now
```

So the SOF DSP booted and the SoundWire codecs (a Realtek RT713 jack codec and two RT1320 amplifiers) were detected. But the kernel's Arrow Lake machine table had **no entry for this exact combination**, so it fell back to a generic HDMI-only setup. The internal speakers and microphones never existed as far as ALSA was concerned, so PipeWire had nothing to show except Dummy Output.

This was **below PipeWire**, not a KDE or configuration problem. My packages were already current (kernel 7.1.9, PipeWire 1.6.8, WirePlumber 0.5.15, sof-firmware 2025.12.2, alsa-ucm-conf 1.2.16.1). I tested downgrading `alsa-ucm-conf` and then dropped the idea, because the kernel message pointed at a missing machine-driver match, not a UCM profile.

The fix was a custom kernel package, `linux-raider`, with a small patch adding this hardware match, installed **alongside** the stock kernel. The full story is in [Custom Kernel and Speaker Audio](/knowledge/hardware-raider-custom-kernel-audio).

### A follow-up: speakers vanish after sleep

Once the speakers worked, they sometimes disappeared after closing the lid and resuming, falling back to Dummy Output again. The kernel hadn't changed and the sound card was still present. WirePlumber had just lost track of the SoundWire codec. A user-level restart brings them straight back, no sudo needed:

```bash
systemctl --user restart wireplumber pipewire pipewire-pulse
```

It happens on every resume, so the durable fix is a resume hook that restarts the user audio stack automatically.

## Key takeaways

- When Wi-Fi flaps with `supplicant-timeout`, the problem is the authentication layer. Switching NetworkManager to the **iwd** backend fixed it for me.
- Set `wifi.iwd.autoconnect=false` so NetworkManager stays in control, and make sure wpa_supplicant isn't also running.
- Bluetooth "not working" on a fresh Arch install is often just a disabled `bluetooth.service`.
- "Dummy Output" in PipeWire means ALSA has no real device. Look at the kernel log before reinstalling audio packages.
- New laptops can need kernel support that hasn't landed upstream yet. Keep the stock kernel as a fallback when you test a custom one.
- Use `journalctl -b` for kernel logs as a normal user, since `dmesg` may be restricted.
