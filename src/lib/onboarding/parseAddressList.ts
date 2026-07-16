/** Parse a multiline pasted address list into draft lot entries. Never invents data. */
export function parseAddressList(text: string): Array<{ label: string; address: string }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.slice(0, 250).map((address, i) => ({
    label: `Lot ${i + 1}`,
    address,
  }));
}