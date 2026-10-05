# Contributing

Amber SSH is an early Windows desktop SSH client. Keep the interface minimal
and discuss larger features in an issue before implementing them.

Use Node.js 24 and pnpm 11.19.0. Install with `pnpm install --frozen-lockfile`,
then run `pnpm test` and `pnpm build` before submitting a pull request.
Use `pnpm start` to launch the built app and `pnpm dist` to build a portable EXE.

Never attach real passwords, private SSH keys, connection databases or terminal
output containing secrets to issues or pull requests. Use fictitious hosts and
credentials when describing a problem. Changes affecting credential storage,
SSH host verification, IPC or release workflows need careful maintainer review.
