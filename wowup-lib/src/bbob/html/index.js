import core from '../core';
import { attrsToString } from '../plugin-helper';

const SELFCLOSE_END_TAG = '/>';
const CLOSE_START_TAG = '</';
const START_TAG = '<';
const END_TAG = '>';

const renderNode = (node, { stripTags = false }) => {
  if (!node) return '';
  const type = typeof node;

  if (type === 'string' || type === 'number') {
    return node;
  }

  if (type === 'object') {
    if (stripTags === true) {
      return renderNodes(node.content, { stripTags });
    }

    if (node.content === null) {
      return [START_TAG, node.tag, attrsToString(node.attrs), SELFCLOSE_END_TAG].join('');
    }

    return [
      START_TAG,
      node.tag,
      attrsToString(node.attrs),
      END_TAG,
      renderNodes(node.content),
      CLOSE_START_TAG,
      node.tag,
      END_TAG,
    ].join('');
  }

  if (Array.isArray(node)) {
    return renderNodes(node, { stripTags });
  }

  return '';
};

const renderNodes = (nodes, { stripTags = false } = {}) =>
  [].concat(nodes).reduce((r, node) => r + renderNode(node, { stripTags }), '');

const toHTML = (source, plugins, options) => core(plugins).process(source, { ...options, render: renderNodes }).html;

export const render = renderNodes;
export default toHTML;
