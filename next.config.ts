import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "mdx"],
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: [],
  },
});

const withMdxConfig = withMDX(nextConfig);

// Sentry активируется только если в env есть DSN — иначе работает обычный nextConfig.
const wrapped = process.env.SENTRY_DSN
  ? withSentryConfig(withMdxConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { disable: true },
      disableLogger: true,
    })
  : withMdxConfig;

export default wrapped;
