# Updates

## Using installed Windows builds

Install `Amber-SSH-Setup-0.2.8-x64.exe` once. Close the old portable client first,
then use the installed shortcut. The application name and ID are unchanged;
connections and encrypted passwords use the same user data directory. Moving to
a different Windows account or computer still requires an encrypted backup.

The installed client checks stable public GitHub releases ten seconds after
startup and every six hours. Click the download icon in the title bar to check
manually. When a newer version is available, click **Update to …**, wait for the
download, then click **Restart and update**. Active SSH sessions and transfers
require confirmation before closing. Canceling leaves the update ready and
sessions open. A normal application exit never installs an update automatically.

Failed checks or downloads offer a retry. A download whose SHA512 checksum does
not match the release manifest cannot be installed. Updates use the fixed
`O1SEeez/amber-ssh` GitHub repository over HTTPS. No server profiles, credentials
or terminal output are sent. GitHub receives ordinary network requests, including
your IP address. Checksums verify integrity relative to the manifest; they do not
replace an independent publisher signature. Builds are currently unsigned; see
[code signing](CODE_SIGNING.md).

Portable EXE/ZIP builds and Linux builds continue to use manual downloads.
No administrator privileges are normally required for the per-user installer.

## Publishing a Windows release

Run `pnpm test` and `pnpm dist`. The builder produces the NSIS setup, portable
EXE, ZIP, setup blockmap and `latest.yml`. Publish a stable GitHub release with
a `v` tag matching `package.json`. Include all of:

- `Amber-SSH-Setup-VERSION-x64.exe`
- `Amber-SSH-Setup-VERSION-x64.exe.blockmap`
- `latest.yml` from that exact build
- Portable EXE, ZIP and SHA256 sums for manual downloads

Do not edit checksum values or reuse a manifest from a different build. Keep
the release draft until uploads finish, then publish it. The manifest references
the setup EXE, never the portable EXE. No GitHub token is shipped in the client.
The Windows Actions artifact includes these files but does not publish them.

Controller tests cover explicit installation, cancellation, concurrent actions,
offline checks and failed downloads. An isolated Windows NSIS integration run
also verified a real 0.2.7 → 0.2.8 install, rejection of a corrupted download,
retry, restart cancellation, automatic restart, unchanged encrypted database and
SSH login with the saved password. That run used a local HTTP test feed;
production uses the configured GitHub HTTPS provider.
