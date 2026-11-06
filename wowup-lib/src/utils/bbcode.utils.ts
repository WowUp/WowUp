import { getUniqAttr, isStringNode, isTagNode } from '../bbob/plugin-helper/index';
import { TagNodeCreate, TagNodeIsOf } from '../bbob/plugin-helper';
import bbobHTML from '../bbob/html';
import { createPreset } from '../bbob/preset';

const renderUrl = (node: any, render: any) =>
  getUniqAttr(node.attrs) ? getUniqAttr(node.attrs) : render(node.content);

const toNode = (tag: any, attrs: any, content: any) => ({
  tag,
  attrs,
  content,
});

const isStartsWith = (node: any, type: any) => node[0] === type;

const asListItems = (content: any) => {
  let listIdx = 0;
  const listItems: any[] = [];

  const createItemNode = () => TagNodeCreate('li');
  const ensureListItem = (val: any) => {
    listItems[listIdx] = listItems[listIdx] || val;
  };
  const addItem = (val: any) => {
    if (listItems[listIdx] && listItems[listIdx].content) {
      listItems[listIdx].content = listItems[listIdx].content.concat(val);
    } else {
      listItems[listIdx] = listItems[listIdx].concat(val);
    }
  };

  content.forEach((el: any) => {
    if (isStringNode(el) && isStartsWith(el, '*')) {
      if (listItems[listIdx]) {
        listIdx++;
      }
      ensureListItem(createItemNode());
      addItem(el.substr(1));
    } else if (isTagNode(el) && TagNodeIsOf(el, '*')) {
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

  return [...listItems];
};

const bbpreset = createPreset({
  size: (node: any) => {
    const keys = Object.keys(node.attrs as any);
    const sizeKey = keys.map((key) => parseInt(key, 10)).find((num) => !isNaN(num) && isFinite(num));

    return {
      tag: 'font',
      attrs: {
        size: sizeKey,
      },
      content: node.content,
    };
  },
  list: (node: any) => {
    const type = getUniqAttr(node.attrs);

    return toNode(type ? 'ol' : 'ul', type ? { type } : {}, asListItems(node.content));
  },
  i: (node: any) => ({
    tag: 'i',
    attrs: node.attrs,
    content: node.content,
  }),
  img: (node: any, opts: any) =>
    toNode(
      'img',
      {
        src: opts.render(node.content),
      },
      null,
    ),
  url: (node: any, opts: any) => ({
    tag: 'a',
    attrs: {
      target: '_blank',
      appExternalLink: 'true',
      href: renderUrl(node, opts.render),
    },
    content: node.content,
  }),
});

export function convertBbcode(str: string): string {
  if (str.trim().length === 0) {
    return '';
  }

  let html: string = bbobHTML(str, bbpreset());

  const lines = html.split('\n');
  lines.forEach((line, idx) => {
    lines[idx] = line.trim().replace(/(^(\r\n|\n|\r)$)|(^(\r\n|\n|\r))|^\s*$/gm, '<br><br>');
  });

  html = lines.join('');

  return html;
}
