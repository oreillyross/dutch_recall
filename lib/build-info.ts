/** Build metadata, injected at build time by next.config.ts (see there for where each value comes from). */
export const BUILD = {
  time: process.env.NEXT_PUBLIC_BUILD_TIME ?? "",
  ref: process.env.NEXT_PUBLIC_BUILD_REF ?? "",
  sha: process.env.NEXT_PUBLIC_BUILD_SHA ?? "",
};
