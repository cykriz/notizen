import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Remark plugin that stamps every AST node with a `data-source-offset`
 * HTML attribute via `data.hProperties`. This survives the remark→rehype
 * conversion and works for both block and inline elements.
 */
export function remarkSourceOffset() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (node.type !== 'root' && node.position?.start.offset !== undefined) {
        const data = (node.data ??= {});
        const hProperties = ((data as Record<string, unknown>).hProperties ??= {}) as Record<string, unknown>;
        hProperties.dataSourceOffset = node.position.start.offset;
      }
    });
  };
}
