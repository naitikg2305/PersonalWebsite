---
title: "Fixing Internal Speakers on the MSI Raider 16 Max with a Custom Arch Kernel (linux-raider)"
category: "Linux: Hardware & Custom Kernel"
slug: "hardware-raider-custom-kernel-audio"
summary: "How I diagnosed missing internal speakers on an MSI Raider 16 Max under Arch Linux, tracked the cause to SoundWire dai_link naming in the Intel sof_sdw machine driver, and fixed it with a patched kernel package called linux-raider."
---

# Fixing internal speakers on the MSI Raider 16 Max with a custom kernel

My main laptop is an **MSI Raider 16 Max HX B2WH** (board MS-2651, PCI subsystem ID `1462:14fb`) running Arch Linux with KDE Plasma 6 on Wayland. Almost everything worked on day one. The internal speakers did not. Fixing them took six kernel builds. I now run a patched kernel package I named **`linux-raider`**, currently `7.1.10.arch1-6`, so `uname -r` reports `7.1.10-arch1-6-raider`.

This article covers the symptoms, how I diagnosed them, the five builds that didn't work, the bug that turned out to be the real cause, and the userspace steps I still needed afterwards. For the packaging side (PKGBUILD, initramfs, bootloader) see [Building a custom Arch Linux kernel package](/knowledge/hardware-building-arch-kernel-packages).

## The problem

- No "Speaker" output in KDE or `wpctl status`. The only real outputs were HDMI/DisplayPort ones from the Intel and NVIDIA GPUs.
- It wasn't a mute, volume, or wrong-profile issue. **ALSA had no internal-speaker PCM device at all**, so PipeWire had nothing to build a sink from.
- Firmware and userspace were already current (PipeWire 1.6.x, WirePlumber 0.5.x, `alsa-ucm-conf`, `sof-firmware`, `linux-firmware-intel`).

## The hardware

The laptop uses Intel Sound Open Firmware (SOF) on Arrow Lake with **SoundWire** codecs, not classic HDA. sysfs showed three devices:

```text
sdw:0:0:025d:0713:01       Realtek RT713 jack/microphone codec   (link 0)
sdw:0:2:025d:1320:01:0     Realtek RT1320 amplifier 0            (link 2)
sdw:0:2:025d:1320:01:1     Realtek RT1320 amplifier 1            (link 2)
```

On the stock kernel (7.1.9 at the time) the log said:

```text
No SoundWire machine driver found for the ACPI-reported configuration
```

The kernel then fell back to a generic HDA machine with an HDMI-only SOF topology. The upstream Arrow Lake machine table (`soc-acpi-intel-arl-match.c`) already handled similar layouts such as RT722+RT1320 and RT712+RT1320, but it had no entry for **RT713 on link 0 plus two RT1320s on link 2**.

## Diagnosis tools I leaned on

```bash
cat /proc/asound/cards
cat /proc/asound/pcm                   # the real truth: which PCMs exist
aplay -l
ls /sys/bus/soundwire/devices/         # are the codecs enumerated and bound?
journalctl -b -k | grep -Ei 'sof|soundwire|rt713|rt1320|topology'
wpctl status
```

I set a strict rule for myself: **a build only counts as a success if it boots and `/proc/asound/pcm` lists an internal speaker endpoint backed by the RT1320 amps.** A package that compiles, or a `sof-soundwire` card that shows up, doesn't prove anything. Several of my failed builds produced exactly that card with nothing but HDMI inside.

## The revision ledger

| Release | What changed | Outcome |
| --- | --- | --- |
| `arch1-1` | First `linux-raider`. Added a machine-table entry, but described only one RT1320 function on link 2. | Superseded |
| `arch1-2` | Described both RT1320 functions (unique IDs 0 and 1) with left/right speaker endpoints. | Built; superseded |
| `arch1-3` | Intermediate build. | No reliable test record kept, so I don't claim anything for it |
| `arch1-4` | Changed the RT713 address to unique ID 0. | Booted. All three codecs attached and bound, but **HDMI PCMs only** |
| `arch1-5` | Put the upstream-consistent RT713 address back. | Booted. **Still HDMI only** |
| `arch1-6` | Left the machine table alone and fixed dai_link naming in `sof_sdw.c`. | **Speaker PCM appeared and played sound** |

### What revisions 4 and 5 taught me

In revision 4 I misread the sysfs name. `sdw:0:0:025d:0713:01` has no unique-ID suffix, so I assumed the RT713 had unique ID 0 and changed its ADR to `0x000030025D071301`. But the sysfs name doesn't show the unique-ID nibble at all, and every working upstream RT713 description uses ID 1 (`0x000031025D071301`). Revision 5 restored that value. It still loaded only `sof-hdmi-pcm5-id3.tplg`, which ruled out the ADR as the cause.

By this point the codecs were clearly fine:

```text
sdw:0:0:025d:0713:01       Attached -> rt712-sdca
sdw:0:2:025d:1320:01:0     Attached -> rt1320-sdca
sdw:0:2:025d:1320:01:1     Attached -> rt1320-sdca
```

The SOF DSP firmware also booted. So discovery and driver binding worked, and the failure had to be somewhere between "machine matched" and "topology loaded".

## Revision 6: the actual root cause

To see what was happening, I re-probed the audio driver live with dynamic debug turned on for the machine driver modules:

```bash
# enable dyndbg for snd_soc_sof_sdw and snd_soc_sdw_utils, then:
echo 0000:80:1f.3 | sudo tee /sys/bus/pci/drivers/sof-audio-pci-intel-mtl/unbind
echo 0000:80:1f.3 | sudo tee /sys/bus/pci/drivers/sof-audio-pci-intel-mtl/bind
```

The trace showed that the machine entry **did** match and the dai_links **were** created, and then every one of them was dropped:

```text
sof_sdw sof_sdw: Found 3 devices with 3 endpoints
sof_sdw sof_sdw: create dai link SDW0-Playback, id 0
sof_sdw sof_sdw: create dai link SDW0-Capture, id 1
sof_sdw sof_sdw: create dai link SDW2-Playback, id 2
sof_sdw sof_sdw: dai_link SDW0-Playback is not supported by separated tplg yet
sof_sdw sof_sdw: dai_link SDW0-Capture is not supported by separated tplg yet
sof_sdw sof_sdw: dai_link SDW2-Playback is not supported by separated tplg yet
sof_sdw sof_sdw: tplg_mask 0x10 tplg_num 1
```

Here's why:

- `sof_sdw_get_tplg_files()` (in `sof-function-topology-lib.c`) works out each dai_link's function **purely by substring match** on its name, looking for `SimpleJack`, `SmartAmp`, or `SmartMic`.
- That suffix is only added when `asoc_sdw_parse_sdw_endpoints()` sets `ctx->append_dai_type = true`. It only does that when one physical SoundWire link carries more than one DAI type, because that's the only case where names could otherwise collide.
- On this board the RT713 (jack) is alone on link 0, and the two RT1320s form one aggregated amp group on link 2. Each link carries exactly one DAI type, so `append_dai_type` stays false.
- The links therefore get plain names like `SDW0-Playback` and `SDW2-Playback`. The topology matcher doesn't recognise them and silently skips all three, which leaves only HDMI.

### The patch

My second patch, `0002-asoc-intel-sof_sdw-force-append_dai_type-msi-raider.patch`, applies on top of the machine-table patch (`0001-asoc-intel-arl-add-rt713-l0-rt1320-l2.patch`). Right after endpoint parsing in `sound/soc/intel/boards/sof_sdw.c` it forces the suffix on, but **only for this exact subsystem ID**, so the naming on every other machine stays the same:

```c
if (mach->mach_params.subsystem_vendor == 0x1462 &&
    mach->mach_params.subsystem_device == 0x14fb)
        ctx->append_dai_type = true;
```

I worked on these patches with AI coding assistants, and the patch headers record that. Neither patch has been reviewed or merged upstream. They are local hardware-enablement patches.

With revision 6 the kernel loads real topologies:

```text
loading topology 0: intel/sof-ipc4-tplg/sof-sdca-jack-id0.tplg
loading topology 1: intel/sof-ipc4-tplg/sof-sdca-1amp-id2.tplg
loading topology 2: intel/sof-ipc4-tplg/sof-hdmi-pcm5-id3.tplg
```

I had expected `sof-sdca-2amp-id2.tplg`, but the amp topology is `1amp`. The two RT1320s aggregate into one link/DAI, and the topology name counts amp *links*, not amp chips. `/proc/asound/card1/pcm` finally showed:

```text
01-00: Jack Out (*) :  : playback 1
01-01: Jack In (*) :  : capture 1
01-02: Speaker (*) :  : playback 1
01-31: Deepbuffer Jack Out (*) :  : playback 1
```

## From "PCM exists" to "audible and labelled"

Having the PCM wasn't enough. I still needed these userspace steps:

1. **DAPM switches defaulted to off.** `Speaker Switch` and the `rt1320-* OT23 L/R Switch` controls were all off. Turning them on with `amixer -c1 cset numid=<n> on` made `speaker-test` audible for the first time. Step 3 later made this unnecessary.
2. **Streams that were already open didn't follow the new default.** Changing the default sink only affects new streams. Chrome stayed on HDMI until I moved its stream with `pactl list sink-inputs short` and `pactl move-sink-input <id> <sink>`.
3. **The real userspace fix was to switch the card from `pro-audio` to `HiFi`.** `alsa-ucm-conf` already ships `sof-soundwire/rt713.conf` and `rt1320.conf`, and the card's component string (`hs:rt713-sdca spk:rt1320`) matched them. I confirmed it with `alsaucm -c sof-soundwire`. WirePlumber doesn't auto-select ACP profiles, though, so the card sat on `pro-audio`, which shows up as about a dozen unlabelled "Pro N" sinks. Switching it fixed both the labels and the routing, because the UCM `Speaker` device runs the same DAPM enable sequence as step 1:
   ```bash
   pactl list cards short | grep sof_sdw
   pactl set-card-profile <card-name> HiFi
   wpctl set-default <id-of-Speaker-sink>
   ```
   WirePlumber remembers this choice in its state directory.
4. **Shorter labels.** A user WirePlumber rule in `~/.config/wireplumber/wireplumber.conf.d/` renames the verbose `node.description` values to "Speaker", "Headphones", "Headset Microphone", and "HDMI 1–3". After that, run `systemctl --user restart wireplumber`. Plasma's applet needed one `plasmashell --replace` before it noticed the profile change.

## Known gaps

- **No built-in microphone.** The internal mics sit on the RT713's second (SDCA mic) function. Revision 6 created no dai_link for it, and `sof-firmware` has no matching mic topology. So "Headset Microphone" is the 3.5 mm jack input, and it records silence when nothing is plugged in. I use a USB conference camera mic or a wired headset instead.
- **Speakers can vanish after suspend.** Sometimes after s2idle resume, WirePlumber shows "Dummy Output" even though the card still exists. That's a userspace problem, not a kernel one. `systemctl --user restart wireplumber pipewire pipewire-pulse` brings the Speaker sink back.

## Maintaining it across kernel updates

- `linux-raider` is a **separate package** next to the stock `linux` package. It never replaces stock, and the stock kernel stays bootable as a fallback.
- It does **not** follow Arch kernel upgrades automatically. I rebase the two patches onto a new Arch `linux` release and rebuild when I need to. I'll retire the package once upstream supports this layout.
- Out-of-tree modules (NVIDIA) build against it through DKMS, so `linux-raider-headers` has to stay installed.
- After any rebuild I run the same checks: `uname -r`, `/proc/asound/pcm`, the topology lines in `journalctl -k`, and `wpctl status`.

## Credits and references

- The Linux kernel ASoC/SOF code, especially `sof_sdw.c`, `soc_sdw_utils.c`, `sof-function-topology-lib.c`, and the Intel ACPI match tables. Upstream Panther Lake tables gave me working RT713+RT1320 examples.
- The SOF project's topology documentation, and `alsa-ucm-conf`'s `sof-soundwire` profiles.
- alsa-ucm-conf issue #784, a similar MSI RT713/RT1320 report, which helped convince me that loaded modules don't prove usable PCMs exist.
- Arch Linux's official `linux` packaging, which my PKGBUILD is based on.

## Key takeaways

- Judge success by `/proc/asound/pcm`, not by modules, cards, or packages. Codecs can be enumerated and bound and you can still have no speakers.
- A sysfs device name isn't an ADR. Don't infer address fields it doesn't show.
- When three guesses at the same fix all fail, stop guessing and trace the driver. A live unbind/bind with dynamic debug found in minutes what five builds had missed.
- The bug was a naming convention: the topology loader matches on string suffixes that this board's link layout never produced.
- The kernel fix is only half the job. The UCM profile (`HiFi`, not `pro-audio`) gives you working routing and readable labels.
