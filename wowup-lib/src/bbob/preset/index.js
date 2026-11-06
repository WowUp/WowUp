const isTagNode = (el) => typeof el === 'object' && !!el.tag;

function process(tags, tree, core, options) {
  tree.walk((node) => (isTagNode(node) && tags[node.tag] ? tags[node.tag](node, core, options) : node));
}

/**
 * Creates preset for @bbob/core
 * @param defTags {Object}
 * @param processor {Function} a processor function of tree
 * @returns {function(*=): function(*=, *=): void}
 */
function createPreset(defTags, processor = process) {
  const presetFactory = (opts = {}) => {
    presetFactory.options = Object.assign(presetFactory.options || {}, opts);

    const presetExecutor = (tree, core) => processor(defTags, tree, core, presetFactory.options);

    presetExecutor.options = presetFactory.options;

    return presetExecutor;
  };

  presetFactory.extend = (callback) => createPreset(callback(defTags, presetFactory.options), processor);

  return presetFactory;
}

export { createPreset };
export default createPreset;
