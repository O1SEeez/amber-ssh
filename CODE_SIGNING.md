# Code signing policy

Current builds are unsigned. Publishing source code or a SHA256 checksum does
not give a binary a trusted Windows signature. Smart App Control can block
these builds. This project does not disable or modify Windows protection.

The project currently has no code signing provider. Free OSS signing may be
reconsidered in the future; no certificate or approval is promised. SignPath
Foundation eligibility is determined by the Foundation:
https://signpath.org/terms

## Intended process

- Maintainer, reviewer and future signing approver: O1SEeez.
- Windows artifacts are built from repository source in GitHub Actions.
- External contributions must be reviewed before release.
- Signing will require manual maintainer approval and MFA on the repository
  and signing accounts, as required by the signing provider.
- Signing credentials must never be committed to the repository.
- After approval, this policy and the build workflow will be updated to name
  the actual provider and distinguish signed and unsigned downloads.

## Privacy

Amber SSH connects to servers chosen by the user. SSH credentials are sent to
that chosen server for authentication; sudo password input is sent within the
SSH session when the user requests elevation. The application also opens TCP
connections to the selected SSH port to measure connection setup time.

There are no built-in telemetry or analytics. Installed Windows builds check
public GitHub releases; see [updates](UPDATES.md). Saved
secrets are encrypted locally through Electron safeStorage: Windows DPAPI or a
supported Linux system keyring. Insecure Linux plaintext backends are rejected.
Private key files remain at the locations selected by the user. Connection
data is not part of this source repository.
