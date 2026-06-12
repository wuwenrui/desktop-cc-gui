/**
 * skill 文件树构建：把扁平的 zip/目录清单（相对路径）组装成嵌套树。
 *
 * 两个数据源共用同一结构：
 * - 已装本地：Rust `market_skill_tree` 返回 `{path, size, is_dir}[]`
 * - 装前预览：lawhub `GET /api/skills/{id}/versions/{v}/files` 返回同构清单
 *
 * 新增文件（fork-friendly）：纯函数，无依赖。
 */

/** 与 Rust SkillTreeEntry / lawhub files API 对齐。 */
export type SkillFileEntry = {
  path: string;
  size: number;
  is_dir: boolean;
};

export type SkillTreeNode = {
  /** 当前节点名（不含父路径）。 */
  name: string;
  /** 相对 skill 根的完整路径。 */
  path: string;
  isDir: boolean;
  size: number;
  children: SkillTreeNode[];
};

const SUB_SKILL_RE = /^sub-skills\/[^/]+_SKILL\.md$/i;

/** 是否是子技能文件（sub-skills/ 下的 *_SKILL.md）。 */
export function isSubSkillPath(path: string): boolean {
  return SUB_SKILL_RE.test(path);
}

function normalizePath(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/\/+$/, "").replace(/^\/+/, "");
}

function sortLevel(nodes: SkillTreeNode[]): void {
  // 文件在前、目录在后，各自按名称排序（与设计稿一致：SKILL.md 等顶级文件先于 sub-skills/）。
  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) {
      return a.isDir ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    sortLevel(node.children);
  }
}

/**
 * 把扁平清单组装成树。中间目录即使清单中没有显式目录条目也会被补出来。
 */
export function buildSkillTree(entries: SkillFileEntry[]): SkillTreeNode[] {
  const roots: SkillTreeNode[] = [];
  const byPath = new Map<string, SkillTreeNode>();

  const ensureDir = (path: string): SkillTreeNode[] => {
    if (!path) {
      return roots;
    }
    const existing = byPath.get(path);
    if (existing) {
      return existing.children;
    }
    const slash = path.lastIndexOf("/");
    const parentChildren = ensureDir(slash >= 0 ? path.slice(0, slash) : "");
    const node: SkillTreeNode = {
      name: slash >= 0 ? path.slice(slash + 1) : path,
      path,
      isDir: true,
      size: 0,
      children: [],
    };
    byPath.set(path, node);
    parentChildren.push(node);
    return node.children;
  };

  for (const entry of entries) {
    const path = normalizePath(entry.path);
    if (!path) {
      continue;
    }
    if (entry.is_dir) {
      ensureDir(path);
      continue;
    }
    if (byPath.has(path)) {
      continue;
    }
    const slash = path.lastIndexOf("/");
    const parentChildren = ensureDir(slash >= 0 ? path.slice(0, slash) : "");
    const node: SkillTreeNode = {
      name: slash >= 0 ? path.slice(slash + 1) : path,
      path,
      isDir: false,
      size: entry.size,
      children: [],
    };
    byPath.set(path, node);
    parentChildren.push(node);
  }

  sortLevel(roots);
  return roots;
}

/** 选默认展示文件：优先根级 SKILL.md（忽略大小写），否则第一个文件。 */
export function pickDefaultFile(entries: SkillFileEntry[]): string | null {
  const files = entries.filter((e) => !e.is_dir);
  const main = files.find(
    (e) => normalizePath(e.path).toLowerCase() === "skill.md",
  );
  if (main) {
    return normalizePath(main.path);
  }
  return files.length > 0 ? normalizePath(files[0].path) : null;
}
