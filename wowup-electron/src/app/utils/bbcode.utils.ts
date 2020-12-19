import { getUniqAttr, isStringNode, isTagNode } from "@bbob/plugin-helper/lib/index";
import bbobHTML from "@bbob/html";
import presetHTML5 from "@bbob/preset-html5";
import { createPreset } from "@bbob/preset";

const renderUrl = (node, render) => (getUniqAttr(node.attrs) ? getUniqAttr(node.attrs) : render(node.content));

const bbpreset = createPreset({
  i: (node) => ({
    tag: "i",
    attrs: node.attrs,
    content: node.content,
  }),
  url: (node, { render }, options) => ({
    tag: "a",
    attrs: {
      target: "_blank",
      appExternalLink: 'true',
      href: renderUrl(node, render),
    },
    content: node.content,
  }),
});

export function convertBbcode(str: string): string {
  return bbobHTML(str, bbpreset());
}
