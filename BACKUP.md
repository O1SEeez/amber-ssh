# Encrypted connection backups

Available in Amber SSH 0.2.6 and later. Both source and target need this version
or newer; the ordinary public JSON export remains compatible with older builds.

## Included data

Connection name, host, port, user and authentication method; persisted SSH/sudo
passwords and private-key passphrases. Metadata and secrets are encrypted together.
Temporary in-memory passwords, private key contents and paths, trusted host
fingerprints, automatic root login, commands and app settings are excluded.

Import adds new connections after an explicit preview. Duplicates are skipped
without changing existing credentials. Imported secrets are encrypted with the
target OS storage. Unavailable secure storage aborts the import without changing
the database. Choose SSH key files again and confirm server fingerprints anew.
Unconfirmed imported data expires from the app after five minutes.

## Format version 1

The UTF-8 JSON envelope has format `amber-ssh-encrypted-connections`, version `1`,
kdf `scrypt-131072-8-1`, cipher `aes-256-gcm`, and base64 fields `salt`, `iv`, `tag`,
`data`. The encrypted plaintext is the version-1 connection document with
`password` and `passphrase` fields for each profile.

- scrypt: N=131072, r=8, p=1; 32-byte derived key; asynchronous execution.
- Fresh 16-byte salt and 12-byte GCM nonce for every export; 16-byte auth tag.
- Authenticated additional data: `amber-ssh-encrypted-connections:1:scrypt-131072-8-1:aes-256-gcm`.
- Parameters are fixed and validated before key derivation; arbitrary KDF costs are rejected.
- Maximum plaintext/ciphertext size: 2 MiB; input document: 3 MiB; up to 1,000 profiles.
- File passwords: 12–1,024 characters on creation; no trimming or normalization.

These scrypt costs follow an [OWASP baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).
Authenticated encryption uses the standard [Node.js crypto API](https://nodejs.org/api/crypto.html).
Changing the password, tag or ciphertext causes an authentication failure before
any connections are imported. This project has not had an independent audit.

## Handling secrets

Exported plaintext exists in application memory during encryption; no plaintext
backup is written to disk. Only ciphertext is written through a temporary file
and renamed into place. Imported secrets stay in the main process and are never
returned to the renderer. Derived-key and plaintext buffers are cleared after
use; JavaScript strings cannot be reliably zeroized. OS encryption does not
protect against malware running as your user.

The file password is not saved. Losing it means losing access to that backup.
Encryption cannot make a weak password resistant to offline guessing. Keep the
file private and choose a long unique passphrase.
