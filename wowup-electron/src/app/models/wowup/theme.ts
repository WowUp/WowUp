export interface ThemeGroup {
  name: string;
  themes: Theme[];
}

interface Theme {
  display: string;
  class: string;
}
