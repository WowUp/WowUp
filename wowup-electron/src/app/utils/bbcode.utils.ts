import { getUniqAttr, isStringNode, isTagNode } from "@bbob/plugin-helper/lib/index";
import TagNode from "@bbob/plugin-helper/lib/TagNode";
import bbobHTML from "@bbob/html";
import presetHTML5 from "@bbob/preset-html5";
import { createPreset } from "@bbob/preset";

const renderUrl = (node, render) => (getUniqAttr(node.attrs) ? getUniqAttr(node.attrs) : render(node.content));

const toNode = (tag, attrs, content) => ({
  tag,
  attrs,
  content,
});

const isStartsWith = (node, type) => node[0] === type;

const asListItems = (content) => {
  let listIdx = 0;
  const listItems = [];

  const createItemNode = () => TagNode.create("li");
  const ensureListItem = (val) => {
    listItems[listIdx] = listItems[listIdx] || val;
  };
  const addItem = (val) => {
    if (listItems[listIdx] && listItems[listIdx].content) {
      listItems[listIdx].content = listItems[listIdx].content.concat(val);
    } else {
      listItems[listIdx] = listItems[listIdx].concat(val);
    }
  };

  content.forEach((el) => {
    if (isStringNode(el) && isStartsWith(el, "*")) {
      if (listItems[listIdx]) {
        listIdx++;
      }
      ensureListItem(createItemNode());
      addItem(el.substr(1));
    } else if (isTagNode(el) && TagNode.isOf(el, "*")) {
      if (listItems[listIdx]) {
        listIdx++;
      }
      ensureListItem(createItemNode());
    } else if (!isTagNode(listItems[listIdx])) {
      listIdx++;
      ensureListItem(el);
    } else if (listItems[listIdx]) {
      addItem(el);
    } else {
      ensureListItem(el);
    }
  });

  return [].concat(listItems);
};

const bbpreset = createPreset({
  size: (node) => {
    const keys = Object.keys(node.attrs);
    const sizeKey = keys.map((key) => parseInt(key, 10)).find((num) => !isNaN(num) && isFinite(num));

    return {
      tag: "font",
      attrs: {
        size: sizeKey,
      },
      content: node.content,
    };
  },
  list: (node) => {
    const type = getUniqAttr(node.attrs);

    return toNode(type ? "ol" : "ul", type ? { type } : {}, asListItems(node.content));
  },
  i: (node) => ({
    tag: "i",
    attrs: node.attrs,
    content: node.content,
  }),
  img: (node, { render }) =>
    toNode(
      "img",
      {
        src: render(node.content),
      },
      null
    ),
  url: (node, { render }, options) => ({
    tag: "a",
    attrs: {
      target: "_blank",
      appExternalLink: "true",
      href: renderUrl(node, render),
    },
    content: node.content,
  }),
});

export function convertBbcode(str: string): string {
  let html: string = bbobHTML(str, bbpreset());

  html = html.replaceAll("\r\n", "<br>");

  return html;
}
