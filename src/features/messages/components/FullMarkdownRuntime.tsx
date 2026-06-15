import { useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { remarkFileLinks } from "../../../utils/remarkFileLinks";
import { getCachedRehypeKatex } from "../../markdown/markdownMath";

export type FullMarkdownComponentProps = Record<string, unknown> & {
  alt?: string;
  children?: ReactNode;
  className?: string;
  href?: string;
  node?: unknown;
  src?: string;
};

export type FullMarkdownComponents = Record<
  string,
  (props: FullMarkdownComponentProps) => ReactNode
>;

export type FullMarkdownUrlTransform = (url: string) => string;

type FullMarkdownRuntimeProps = {
  components: FullMarkdownComponents;
  katexReady: boolean;
  softBreaks: boolean;
  urlTransform: FullMarkdownUrlTransform;
  value: string;
};

const SUPPORTS_REGEX_LOOKBEHIND = (() => {
  try {
    void new RegExp("(?<=a)b");
    return true;
  } catch {
    return false;
  }
})();

export function FullMarkdownRuntime({
  components,
  katexReady,
  softBreaks,
  urlTransform,
  value,
}: FullMarkdownRuntimeProps) {
  const remarkPluginsMemo = useMemo(
    () => {
      const plugins = softBreaks
        ? [remarkBreaks, remarkMath, remarkFileLinks]
        : [remarkMath, remarkFileLinks];
      if (SUPPORTS_REGEX_LOOKBEHIND) {
        return [remarkGfm, ...plugins];
      }
      return plugins;
    },
    [softBreaks],
  );

  const rehypePluginsMemo = useMemo(
    () => {
      const plugins: unknown[] = [
        rehypeRaw,
        [rehypeSanitize, {
          ...defaultSchema,
          tagNames: [
            ...(defaultSchema.tagNames ?? []),
            "details", "summary", "abbr", "mark", "ins", "del",
            "sub", "sup", "kbd", "var", "samp",
          ],
          attributes: {
            ...defaultSchema.attributes,
            "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "class", "style"],
            img: [...(defaultSchema.attributes?.img ?? []), "loading"],
          },
        }],
      ];
      const cachedRehypeKatex = getCachedRehypeKatex();
      if (katexReady && cachedRehypeKatex) {
        plugins.push(cachedRehypeKatex);
      }
      return plugins as Parameters<typeof ReactMarkdown>[0]["rehypePlugins"];
    },
    [katexReady],
  );

  return (
    <ReactMarkdown
      remarkPlugins={remarkPluginsMemo}
      rehypePlugins={rehypePluginsMemo}
      urlTransform={urlTransform}
      components={components as Components}
    >
      {value}
    </ReactMarkdown>
  );
}
