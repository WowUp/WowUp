export function getGameVersionList(interfaceStrs: string[]): string[] {
  return interfaceStrs.map((x) => getGameVersion(x));
}

export function getGameVersion(interfaceStr: string | undefined): string {
  if (typeof interfaceStr !== 'string' || interfaceStr.length === 0) {
    return Array(3).fill('0').join('.');
  }

  if (interfaceStr.toString().indexOf('.') !== -1) {
    return interfaceStr;
  }

  // split the long interface into 3 chunks, major minor patch
  const chunks = [
    interfaceStr.substring(0, interfaceStr.length - 4),
    interfaceStr.substring(interfaceStr.length - 4, interfaceStr.length - 2),
    interfaceStr.substring(interfaceStr.length - 2),
  ];
  return chunks.map((c) => parseInt(c, 10)).join('.');
}
