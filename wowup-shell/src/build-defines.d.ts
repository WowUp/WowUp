// Values scripts/build-shell.js bakes into the shell at build time

/** The flavor this shell was packaged as ("wago" or "ow"); it only loads bundles of the same flavor */
declare const __SHELL_FLAVOR__: string;

/**
 * Public keys trusted on top of BUNDLE_PUBLIC_KEYS, only in local builds packaged from a bundle signed with the
 * throwaway local key. Always empty in release builds.
 */
declare const __EXTRA_BUNDLE_KEYS__: Record<string, string>;

/**
 * Hosts to check for newer bundles, in order. A local build checks the `bundle:publish:local --serve` server
 * (http://localhost:8787/pages) instead of wowup-bundles' GitHub Pages.
 */
declare const __BUNDLE_UPDATE_URLS__: string[];
