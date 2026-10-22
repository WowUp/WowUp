import { BundlePublicKeys } from "./bundle-manifest";

/**
 * Public keys whose signed bundle manifests the shell accepts, by key id. Keep the current key and the
 * next one here so the signing key can rotate without a shell release. Generate a key pair with
 * `node scripts/generate-bundle-key.mts <key-id> <private-key-file>`, which prints the entry to add.
 * Signatures aren't checked until bundle loading lands.
 */
export const BUNDLE_PUBLIC_KEYS: BundlePublicKeys = {
  // Current signing key
  "2026-a":
    "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEANmNszz8cMRnzc9BGH0YLh+bCQalgKH6jguz0orAXrGc=\n-----END PUBLIC KEY-----\n",
  // Next signing key, kept offline until a rotation
  "2027-a":
    "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAUUjA3hQhh3VqvycvrnXs+6cb3+yWG1aP7Lrbr53anhg=\n-----END PUBLIC KEY-----\n",
};
