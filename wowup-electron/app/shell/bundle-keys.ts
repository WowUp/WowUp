import { BundlePublicKeys } from "./bundle-manifest";

/**
 * Public keys whose signed bundle manifests the shell accepts, by key id. Keep the current key and the
 * next one here so the signing key can rotate without a shell release. Generate a key pair with
 * `node scripts/generate-bundle-key.mts <key-id> <private-key-file>`, which prints the entry to add.
 * Empty until the first key is generated; signatures aren't checked until bundle loading lands.
 */
export const BUNDLE_PUBLIC_KEYS: BundlePublicKeys = {};
