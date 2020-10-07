export function stringIncludes(value: string, search: string) {
  if (value == null) {
    return false;
  }
  return value.trim().toLowerCase().indexOf(search.trim().toLowerCase()) >= 0;
}