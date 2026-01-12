export function removeExtension(str: string): string {
  return str.replace(/\.[^/.]+$/, '');
}
