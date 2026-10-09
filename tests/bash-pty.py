"""CI fixture: real Bash/readline on a Linux PTY, with SSH window changes."""
import base64
import fcntl
import json
import os
import pty
import select
import signal
import struct
import sys
import termios

cols, rows = map(int, sys.argv[1:])
pid, master = pty.fork()
if pid == 0:
    fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
    os.environ.update(TERM='xterm-256color', PS1='amber$ ', LC_ALL='C.UTF-8')
    os.execvp('bash', ['bash', '--noprofile', '--norc', '-i'])
try:
    pending = b''
    while True:
        readable, _, _ = select.select([master, 0], [], [])
        if master in readable:
            try:
                data = os.read(master, 65536)
            except OSError:
                break
            if not data:
                break
            print(base64.b64encode(data).decode(), flush=True)
        if 0 in readable:
            data = os.read(0, 65536)
            if not data:
                break
            pending += data
            while b'\n' in pending:
                line, pending = pending.split(b'\n', 1)
                message = json.loads(line)
                if 'resize' in message:
                    cols, rows = message['resize']
                    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
                    os.kill(pid, signal.SIGWINCH)
                else:
                    os.write(master, base64.b64decode(message['data']))
finally:
    os.close(master)
    try:
        os.kill(pid, signal.SIGHUP)
    except ProcessLookupError:
        pass
    os.waitpid(pid, 0)
