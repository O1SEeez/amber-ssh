<p align="center">
  <img src="assets/icon.png" width="88" alt="Amber SSH logo">
</p>
<h1 align="center">Amber SSH</h1>
<p align="center">Your terminal. Just the essentials.</p>
<p align="center"><a href="README.ru.md">Русский</a> · <a href="https://github.com/O1SEeez/amber-ssh/releases">Downloads</a> · <a href="https://github.com/O1SEeez/amber-ssh/issues">Feedback</a> · <a href="CONTRIBUTING.md">Contributing</a></p>

A minimal SSH desktop client for Windows and Linux, with a calm dark interface and orange accents. Built for people who want to connect, work and get on with their day.

![Amber SSH terminal with a local demo connection](assets/screenshot-terminal.png)

## Download

| Platform | Build | Version |
| --- | --- | --- |
| Windows 10/11 x64 | [Installer — automatic updates](https://github.com/O1SEeez/amber-ssh/releases/download/v0.2.8/Amber-SSH-Setup-0.2.8-x64.exe) · [Portable ZIP](https://github.com/O1SEeez/amber-ssh/releases/download/v0.2.8/Amber-SSH-0.2.8-x64.zip) · [Single EXE](https://github.com/O1SEeez/amber-ssh/releases/download/v0.2.8/Amber-SSH-0.2.8-x64.exe) | 0.2.8 |
| Debian / Ubuntu / Mint x64 | [DEB installer](https://github.com/O1SEeez/amber-ssh/releases/download/v0.2.5/Amber-SSH-0.2.5-linux-amd64.deb) | 0.2.5 |
| Linux x64, including Arch | [AppImage](https://github.com/O1SEeez/amber-ssh/releases/download/v0.2.5/Amber-SSH-0.2.5-linux-x86_64.AppImage) · [tar.gz](https://github.com/O1SEeez/amber-ssh/releases/download/v0.2.5/Amber-SSH-0.2.5-linux-x64.tar.gz) | 0.2.5 |

macOS is planned; no Mac build is available yet. These are the latest available builds for each platform.

**Windows:** run **Amber-SSH-Setup-0.2.8-x64.exe** to install for your user. Existing connections and saved passwords remain available when using the same Windows account. Close the old portable client before installation and use the installed shortcut afterward. Future releases appear in the title bar: click to download, then **Restart and update**. Open SSH sessions require confirmation before closing. Downloading an update does not install it when you close the app normally.

Portable builds remain available: extract the entire ZIP and run `Amber SSH.exe` inside it, keeping the other files alongside the EXE. The single-file EXE extracts itself on every launch and can start more slowly. Portable EXE/ZIP builds and Linux builds use manual updates. [Update behavior and publishing details](UPDATES.md).

**Debian / Ubuntu / Mint:** install the downloaded package with:

```sh
sudo apt install ./Amber-SSH-0.2.5-linux-amd64.deb
```

**AppImage:** make it executable, then run it:

```sh
chmod +x Amber-SSH-0.2.5-linux-x86_64.AppImage
./Amber-SSH-0.2.5-linux-x86_64.AppImage
```

If FUSE is unavailable, use `--appimage-extract-and-run` or extract the tar.gz and run `./amber-ssh`. Arch uses the AppImage or archive, rather than the DEB package. Linux password saving needs an unlocked GNOME Keyring or KWallet; without one, turn off “Remember password”.

**Builds are currently unsigned.** Windows may show a warning or block execution through Smart App Control. SHA256 files in each release help check download integrity; they are not publisher signatures. See [code signing](CODE_SIGNING.md).

## What you can do

- Save connections and open independent terminal tabs; authenticate with a password or SSH key.
- Store passwords locally using Windows DPAPI or a supported Linux system keyring.
- Use “Switch to root” or automatic root login with your saved user password, when your server allows sudo.
- Reconnect in the same tab while keeping terminal scrollback, and search terminal output.
- Copy and paste with shortcuts that work across keyboard layouts; preview pastes of four or more lines.
- Find connections quickly, save commands with a confirmation before running, and import/export connection settings without secrets.
- Transfer saved passwords between computers using a password-protected encrypted backup (0.2.6+).
- Browse remote directories and upload/download individual files using the SFTP side panel.
- Switch between English and Russian without closing sessions.
- Check for Windows updates automatically in installed builds; download and restart only when you choose.

![SFTP beside the terminal](assets/screenshot-sftp.png)

*Screenshots show the actual app connected to an isolated local demo server. No personal servers or credentials are shown.*

## First connection

1. Click **+** below the connection list and enter the name, address and user.
2. Choose password or key authentication. Set “Remember password” if you want it stored locally.
3. Connect, verify the server fingerprint using a trusted source, then approve it.
4. Open the session menu **⋮** for SFTP, reconnecting or switching to root.

`Ctrl+C` copies selected text; without a selection it interrupts the remote command. `Ctrl+V` or right-click pastes, `Ctrl+F` searches terminal output, and `Ctrl+K` finds a connection. Change the interface language from **⋮** beside **Connections**.

## Transfer connections with passwords (0.2.6+)

Open **⋮** beside **Connections** → **Export with passwords**. Choose a long, unique file password (at least 12 characters), repeat it and save the `.amber` file. On the other computer, choose **Import connections**, select that file, enter its password and confirm the preview. Saved SSH passwords and key passphrases are restored and encrypted with the target computer's system storage.

The complete connection list, including server names and addresses, is encrypted using AES-256-GCM with a scrypt-derived key. The file password is not saved or recoverable. Only persisted secrets are included; SSH key files and paths, temporary session passwords, trusted host fingerprints and automatic root login are excluded. Select keys again and verify each server fingerprint. Existing connections are skipped, not overwritten.

The ordinary JSON export still excludes secrets. Linux requires an available system keyring to restore saved secrets. Linux 0.2.5 does not support encrypted backups; use a 0.2.6+ build on both computers. [Format and security details](BACKUP.md).

## Status and limitations

Amber SSH is an early project and has not undergone an independent security audit. Saved-password encryption does not protect against malware running as your user. There is no built-in telemetry or analytics. Installed Windows builds check public GitHub releases; server addresses, passwords and terminal output are never included in update requests. Read [Security](SECURITY.md) before relying on it for sensitive work.

Sudo automation applies to the app's root action and standard sudo prompts; it does not automatically fill arbitrary commands or MFA challenges. SFTP keeps the original SSH user's permissions, even after switching to root in the terminal. Folder transfers, rename/delete actions, SSH tunnels, command completion and theme switching are not implemented yet.

The status bar's TCP value measures connection setup to the SSH port, not ICMP ping or command latency. RX/TX refers to terminal traffic; SFTP progress is shown separately.

## Help improve Amber SSH

Try a build and [report a bug](https://github.com/O1SEeez/amber-ssh/issues/new) with your OS, app version, steps and expected result. Remove real hosts, passwords, keys and sensitive terminal output from attachments. Security issues need a [private reporting channel](SECURITY.md).

Feedback, documentation improvements and small fixes are welcome. If Amber SSH is useful to you, a GitHub star helps others discover it. See [contributing](CONTRIBUTING.md) for development and review guidelines.

## Build from source

Use Node.js 24 and pnpm 11.19.0:

```sh
git clone https://github.com/O1SEeez/amber-ssh.git
cd amber-ssh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm start
```

Package on Windows with `pnpm dist` (portable EXE and ZIP), or on Linux with `pnpm dist:linux` (AppImage, DEB and tar.gz). Output is written to `release/`.

Built with Electron, React, TypeScript, xterm.js and ssh2. See the [detailed Russian guide](GUIDE.ru.md), [changelog](CHANGELOG.md) and [build workflows](.github/workflows).

## License

[MIT](LICENSE). Dependencies retain their own licenses.
