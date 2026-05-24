export type DiffTreeFolderNode<T extends { path: string }> = {
  key: string;
  name: string;
  path: string;
  descendantPaths: string[];
  folders: Map<string, DiffTreeFolderNode<T>>;
  files: T[];
};

export function buildDiffTree<T extends { path: string }>(
  files: T[],
  section: string,
): DiffTreeFolderNode<T> {
  const root: DiffTreeFolderNode<T> = {
    key: `${section}:/`,
    name: "",
    path: "",
    descendantPaths: [],
    folders: new Map(),
    files: [],
  };

  for (const file of files) {
    const parts = file.path.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length === 0) {
      continue;
    }

    root.descendantPaths.push(file.path);
    let node = root;

    for (let index = 0; index < parts.length - 1; index += 1) {
      const segment = parts[index] ?? "";
      const nextKey = `${node.key}${segment}/`;
      let child = node.folders.get(segment);
      if (!child) {
        child = {
          key: nextKey,
          name: segment,
          path: node.path ? `${node.path}/${segment}` : segment,
          descendantPaths: [],
          folders: new Map(),
          files: [],
        };
        node.folders.set(segment, child);
      }
      child.descendantPaths.push(file.path);
      node = child;
    }

    node.files.push(file);
  }

  return root;
}

function compactDiffTreeFolder<T extends { path: string }>(
  folder: DiffTreeFolderNode<T>,
): DiffTreeFolderNode<T> {
  let current = folder;
  const labels = [folder.name];

  while (current.files.length === 0 && current.folders.size === 1) {
    const next = Array.from(current.folders.values())[0];
    if (!next) {
      break;
    }
    labels.push(next.name);
    current = next;
  }

  const compactedFolders = new Map<string, DiffTreeFolderNode<T>>();
  Array.from(current.folders.values()).forEach((child) => {
    const compactedChild = compactDiffTreeFolder(child);
    compactedFolders.set(compactedChild.key, compactedChild);
  });

  return {
    key: current.key,
    name: labels.join("."),
    path: current.path,
    descendantPaths: folder.descendantPaths,
    folders: compactedFolders,
    files: current.files,
  };
}

export function compactDiffTree<T extends { path: string }>(
  tree: DiffTreeFolderNode<T>,
): DiffTreeFolderNode<T> {
  const folders = new Map<string, DiffTreeFolderNode<T>>();
  Array.from(tree.folders.values()).forEach((folder) => {
    const compactedFolder = compactDiffTreeFolder(folder);
    folders.set(compactedFolder.key, compactedFolder);
  });

  return {
    ...tree,
    folders,
  };
}
