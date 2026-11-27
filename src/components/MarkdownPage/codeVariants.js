// Pair adjacent fenced examples by explicit interface metadata, not syntax language.
export function remarkCodeVariants() {
  return (tree) => {
    let hasVariants = false;

    function visit(parent) {
      if (!Array.isArray(parent.children)) return;

      const grouped = [];

      for (let i = 0; i < parent.children.length; i++) {
        const first = parent.children[i];
        const second = parent.children[i + 1];

        if (
          first.type === 'code' &&
          first.meta === 'interface=python' &&
          second?.type === 'code' &&
          second.meta === 'interface=curl'
        ) {
          grouped.push({
            type: 'codeVariants',
            data: {
              hName: 'div',
              hProperties: {
                dataCodeVariants: 'true',
              },
            },
            children: [first, second],
          });

          hasVariants = true;
          i++;
        } else {
          visit(first);
          grouped.push(first);
        }
      }

      parent.children = grouped;
    }

    visit(tree);

    if (hasVariants) {
      const heading = tree.children.findIndex(
        node => node.type === 'heading' && node.depth === 1
      );

      tree.children.splice(heading + 1, 0, {
        type: 'interfaceSelector',
        data: {
          hName: 'div',
          hProperties: {
            dataInterfaceSelector: 'true',
          },
        },
        children: [],
      });
    }
  };
}