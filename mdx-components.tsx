import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function isInternal(href: string): boolean {
  return href.startsWith("/") || href.startsWith("#");
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    a: ({ href, children, ...rest }: ComponentProps<"a">) => {
      const target = href ?? "";
      if (isInternal(target)) {
        return (
          <Link href={target} {...rest}>
            {children}
          </Link>
        );
      }
      return (
        <a href={target} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      );
    },
    // "Callout" для важных заметок в mdx: <Callout type="warn">...</Callout>
    Callout: ({ type = "info", children }: { type?: "info" | "warn" | "tip"; children: ReactNode }) => (
      <div className={`help-callout help-callout-${type}`}>{children}</div>
    ),
    ...components,
  };
}
