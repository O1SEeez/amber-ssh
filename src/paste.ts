// Count explicit line breaks, not rows created by terminal wrapping.
// A final newline terminates the last line; it does not add another command.
export function pasteNeedsConfirmation(text:string):boolean {
  const normalized=text.replace(/\r\n?/g,'\n');
  const lines=(normalized.endsWith('\n')?normalized.slice(0,-1):normalized).split('\n');
  return lines.length>3;
}
