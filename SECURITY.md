# Security

This project is an early prototype, not a security-audited SSH client.
Report issues using the latest available build for your operating system.
Fixes are developed on the main branch and included in subsequent releases.

Do not post passwords, private keys, connection files, or exploitable security
details in public issues. If GitHub private vulnerability reporting is enabled,
use the repository Security tab to report a vulnerability privately. Otherwise,
open an issue requesting a private reporting channel without including the
vulnerability details or secrets.

Saved secrets use Electron safeStorage with Windows DPAPI or a supported Linux
system keyring (GNOME Keyring / KWallet). The Linux basic_text fallback is
rejected. Without a supported keyring, disable password saving. Encryption at
rest does not protect against malware running as the same operating system user.
SSH host fingerprints require confirmation, including when a known key changes.
The app does not change sudoers or Windows security settings.

See [Code signing policy](CODE_SIGNING.md) for the current unsigned-build status.
