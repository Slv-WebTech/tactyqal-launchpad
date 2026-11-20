// distDir is overridable so the e2e suite can build a second copy of the site pointed at an unreachable API
// (NEXT_PUBLIC_* values are inlined at build time). Default behaviour is unchanged.
export default {
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
