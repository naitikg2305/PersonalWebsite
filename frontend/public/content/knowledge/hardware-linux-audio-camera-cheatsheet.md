---
title: "Linux Audio and Camera Cheatsheet: ALSA, PipeWire, WirePlumber, Bluetooth, and V4L2"
category: "Linux: Hardware & Custom Kernel"
slug: "hardware-linux-audio-camera-cheatsheet"
summary: "A plain-English map of the Linux audio and camera stack (ALSA, PipeWire, WirePlumber, BlueZ, V4L2) with the everyday commands and fixes I use for missing speakers, wrong defaults, Bluetooth headset mics, and the wrong webcam on my Arch laptop."
---

# Linux audio and camera cheatsheet

I wrote this after one session that went through a Bluetooth mic that kept dropping, speakers that vanished after suspend, and a conference camera nobody could select. On Linux, audio and video aren't a single settings screen. They're a stack of layers, and most problems become easy once you know which layer is misbehaving. The machine is my MSI Raider 16 Max on Arch Linux with KDE Plasma 6. For the kernel-level speaker fix, see [Fixing internal speakers with a custom kernel](/knowledge/hardware-raider-custom-kernel-audio).

## The layers

| Layer | What it is | Rough Windows equivalent |
| --- | --- | --- |
| **ALSA** | Kernel sound drivers, the raw hardware | Device driver |
| **PipeWire** | Audio *and* camera server that every app talks to | Audio engine + camera frame server |
| **WirePlumber** | PipeWire's session manager: defaults, card profiles, remembered choices | The brain behind Sound settings |
| **pipewire-pulse** | PulseAudio compatibility, which is why `pactl` still works | n/a |
| **BlueZ** | Bluetooth stack that hands headsets to PipeWire | Bluetooth settings |
| **V4L2** | Kernel camera layer (`/dev/video*`) | Camera driver |
| **xdg-desktop-portal** | Permission gatekeeper for Flatpak apps | Privacy → Camera toggle |

Rule of thumb: if `/proc/asound/pcm` doesn't list a device, it's a kernel/ALSA problem. If ALSA has it but your desktop doesn't, it's PipeWire/WirePlumber.

## Everyday audio commands

```bash
wpctl status                         # everything PipeWire sees; '*' = default; numbers = node IDs
wpctl set-default <id>               # set default speaker / mic / camera
wpctl inspect <id>                   # details of one node

# Stable names survive reboots; numeric IDs don't
pactl get-default-sink; pactl get-default-source
pactl set-default-sink   <sink-name>
pactl set-default-source <source-name>

# Card profiles
pactl list cards | grep -E "Name:|Active Profile"
pactl set-card-profile <card-name> HiFi
```

**Keep the onboard card on `HiFi`, never `Pro Audio`.** On my SoundWire laptop, `pro-audio` shows a dozen unlabelled "Pro N" outputs and no proper Speaker/Headphones routing. `HiFi` uses the ALSA UCM profile and gives correctly named ports.

**Streams that are already playing don't follow a new default.** Move them explicitly:

```bash
pactl list sink-inputs short
pactl move-sink-input <stream-id> <sink-name-or-id>
```

## "My speakers disappeared" (after suspend)

Symptom: after a lid-close/resume, the only output is "Dummy Output", even though `pactl list cards short` still shows the sound card. WirePlumber lost track of the codec on resume. This isn't a kernel problem, and I didn't need to reboot or check whether I'd fallen back to the stock kernel (`uname -r` confirms which kernel is running). A user-level restart fixes it, and apps reconnect on their own:

```bash
systemctl --user restart wireplumber pipewire pipewire-pulse
```

None of this needs sudo. These are per-user services.

## Microphones: know what you actually have

On my laptop the input labelled **"Headset Microphone" is the 3.5 mm jack, not a built-in mic**. Under Linux the internal mics aren't exposed yet (that's a kernel/topology gap). With nothing plugged in, it records pure silence. Web apps like Meet and Teams happily choose it by default and send silence, so I pick my USB conference-camera mic explicitly. A wired headset in the jack also works.

## Bluetooth headset mic

Bluetooth headphones have two modes: **A2DP** for music (good quality, no mic) and **HFP** for calls (mic, phone-quality audio). WirePlumber switches to HFP when an app opens the mic.

My Intel BE200 Wi-Fi/Bluetooth card corrupted the HFP voice link: `journalctl -k` showed `corrupted SCO packet`, then the transport died and the headphones disconnected within a minute. Disabling the mSBC wideband codec fixed it:

```bash
mkdir -p ~/.config/wireplumber/wireplumber.conf.d
cat > ~/.config/wireplumber/wireplumber.conf.d/50-bluez-no-msbc.conf <<'EOC'
monitor.bluez.properties = {
  bluez5.enable-msbc = false
}
EOC
systemctl --user restart wireplumber
```

After that, a 40-second mic test held with only the usual handful of SCO warnings during link setup and no transport failure.

To get the headset mic for a call by hand:

```bash
bluetoothctl disconnect <MAC>; bluetoothctl connect <MAC>
pactl set-card-profile bluez_card.<MAC_with_underscores> headset-head-unit   # mic mode
# afterwards, back to music quality:
pactl set-card-profile bluez_card.<MAC_with_underscores> a2dp-sink
```

If it still drops, the next thing I'd try is disabling Bluetooth USB autosuspend (`options btusb enable_autosuspend=0` in `/etc/modprobe.d/`, then reboot). The fallback is to listen on the headphones in A2DP and use a different mic.

### Headphones connected but missing from the audio list

After a suspend, `bluetoothctl info` said `Connected: yes` but there was no headphone sink. WirePlumber had logged `RegisterEndpoint() failed: AlreadyExists`: it re-initialised its Bluetooth monitor while the old registration was still held. `systemctl --user restart wireplumber` brought the sink back without re-pairing.

## Cameras

```bash
v4l2-ctl --list-devices                         # which /dev/video* is which camera
v4l2-ctl -d /dev/video0 --list-formats-ext      # resolutions and frame rates
v4l2-ctl -d /dev/video0 --list-ctrls            # zoom, white balance, ...
wpctl status                                    # see which app is using which camera
```

Each physical camera usually creates **two** `/dev/video` nodes, one for video and one for metadata. Only the first matters.

**Browsers ignore the PipeWire default camera.** Chrome, Teams, and Meet list every camera in their own settings, so pick it there. My laptop exposes both "FHD Webcam" (real RGB) and "Integrated IR Camera" (infrared, used for face login). When Teams showed a black image, it had simply chosen the IR camera. Selecting "FHD Webcam" fixed it instantly.

Some Flatpak apps remember cameras in their own way. GNOME Snapshot stores the camera's *display name* (including the ` (V4L2)` suffix), so you can set it with `flatpak run --command=gsettings org.gnome.Snapshot set org.gnome.Snapshot last-camera-id "<name from wpctl status>"`. Kamoso stores a PipeWire node ID, which changes across reboots, so you may need to pick the camera again.

## Where to look when it breaks

```bash
journalctl --user -u wireplumber -u pipewire -u pipewire-pulse --since "10 min ago"
journalctl -k --since "10 min ago" | grep -iE "bluetooth|usb|uvc|snd"
cat /proc/asound/pcm
```

## Key takeaways

- Find the failing layer first: ALSA (`/proc/asound/pcm`), then PipeWire/WirePlumber (`wpctl status`), then the app's own device picker.
- Restarting WirePlumber is the safe, sudo-free fix for most "device vanished" problems, especially after suspend.
- Keep the onboard card on the `HiFi` profile, not `Pro Audio`.
- A mic that records silence may be an empty headset jack, not a broken mic.
- Browsers choose their own camera. An IR face-login camera in the list is a common cause of "black webcam".
