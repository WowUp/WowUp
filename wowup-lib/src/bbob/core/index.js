import { parse } from '../parser';
import { iterate, match } from './utils';

function walk(cb) {
  return iterate(this, cb);
}

export default function bbob(plugs) {
  const plugins = typeof plugs === 'function' ? [plugs] : plugs || [];

  let options = {
    skipParse: false,
  };

  return {
    process(input, opts) {
      options = opts || {};

      const parseFn = options.parser || parse;
      const renderFn = options.render;
      const data = options.data || null;

      if (typeof parseFn !== 'function') {
        throw new Error('"parser" is not a function, please pass to "process(input, { parser })" right function');
      }

      let tree = options.skipParse
        ? input || []
        : parseFn(input, options);

      // raw tree before modification with plugins
      const raw = tree;

      tree.messages = [];
      tree.options = options;
      tree.walk = walk;
      tree.match = match;

      plugins.forEach((plugin) => {
        tree = plugin(tree, {
          parse: parseFn,
          render: renderFn,
          iterate,
          match,
          data,
        }) || tree;
      });

      return {
        get html() {
          if (typeof renderFn !== 'function') {
            throw new Error('"render" function not defined, please pass to "process(input, { render })"');
          }
          return renderFn(tree, tree.options);
        },
        tree,
        raw,
        messages: tree.messages,
      };
    },
  };
}
