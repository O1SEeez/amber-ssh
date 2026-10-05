# Security

This project is an early prototype, not a security-audited SSH client.
Only the latest released version receives fixes.

Do not post passwords, private keys, connection files, or exploitable security
details in public issues. If GitHub private vulnerability reporting is enabled,
use the repository Security tab to report a vulnerability privately. Otherwise,
open an issue requesting a private reporting channel without including the
vulnerability details or secrets.

Saved secrets use Windows DPAPI through Electron safeStorage. Encryption at
rest does not protect against malware running as the same Windows user.
SSH host fingerprints require confirmation, including when a known key changes.
The app does not change sudoers or Windows security settings.

See [Code signing policy](CODE_SIGNING.md) for the current unsigned-build status.
