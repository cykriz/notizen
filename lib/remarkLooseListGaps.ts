import type { List, Root } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Remark plugin that adds a `data-blank-before` attribute to list items
 * that follow a blank line. This lets CSS add spacing only where the
 * author intentionally left a gap — instead of the default CommonMark
 * behaviour where a single blank line makes every item in the list loose.
 */
export function remarkLooseListGaps() {
  return (tree: Root) => {
    visit(tree, 'list', (node: List) => {
      if (node.spread !== true) {
        return;
      }

      const children = node.children;
      for (let i = 1; i < children.length; i++) {
        const prev = children[i - 1];
        const curr = children[i];
        if (!prev.position || !curr.position) {
          continue;
        }

        if (curr.position.start.line - prev.position.end.line > 1) {
          const data = (curr.data ??= {});
          const hp = ((data as Record<string, unknown>).hProperties ??= {}) as Record<string, unknown>;
          hp.dataBlankBefore = 'true';
        }
      }
    });
  };
}
