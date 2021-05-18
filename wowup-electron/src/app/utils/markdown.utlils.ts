import * as MarkdownIt from "markdown-it";

export function convertMarkdown(markdown: string): string {
  const md = new MarkdownIt({
    html: true,
    breaks: false,
  });

  let html = md.render(markdown?.trim() ?? "");
  html = html.replace(/(?:\r\n|\r|\n)/g, "");

  return html;
}
