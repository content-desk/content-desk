export const appName = "Tanstack Start";
export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";

const MARKDOWN_EXTENSION_PATTERN = /\.md$/;

// fill this with your actual GitHub info, for example:
export const gitConfig = {
  branch: "main",
  repo: "fumadocs",
  user: "fuma-nama",
};

export function encodeMarkdownUrl(slugs: string[], locale?: string) {
  const segments = [...slugs];
  if (segments.length === 0) {
    segments.push("index.md");
  } else {
    segments[segments.length - 1] += ".md";
  }

  return (
    "/" +
    [locale, ...docsRoute.split("/"), ...segments].filter(Boolean).join("/")
  );
}

/** @returns page slugs */
export function decodeMarkdownUrl(segments: string[]) {
  if (segments.length === 0) {
    return [];
  }

  const out = [...segments];
  const lastIndex = out.length - 1;
  const lastSegment = out.at(-1);

  if (lastSegment !== undefined) {
    out[lastIndex] = lastSegment.replace(MARKDOWN_EXTENSION_PATTERN, "");
  }
  if (out.length === 1 && out[0] === "index") {
    out.pop();
  }
  return out;
}
