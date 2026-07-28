<p align="center">
  <img src="https://cdn.wowup.io/site/assets/icons/android-chrome-512x512.png" width="200" />
</p>

# WowUp Client Repository

[![WowUp on Discord](https://img.shields.io/static/v1?label=Discord&message=WowUp&color=7289DA)](https://discord.gg/rk4F5aD)
[![WowUp on Patreon](https://img.shields.io/static/v1?label=Patreon&message=WowUp&color=f96854)](https://www.patreon.com/jliddev)

This is the repository for our [WowUp](https://wowup.io) client with [CurseForge](https://curseforge.com) support for Windows, Mac, and Linux.

## WowUp

![image](https://user-images.githubusercontent.com/20467484/150164985-673d02da-e7ec-42aa-b77d-655c8e3117ff.png)

WowUp is the community centered World of Warcraft addon updater. We attempt to bring the addon community together in an easy to use updater application. We have an ever growing list of supported features.

- Support for all major addon sources
- Discover or find new addons across addon sources
- Handle all your different World of Warcraft clients
- Auto updates
- [Companion addon](https://github.com/WowUp/WowUp.Addon)

## Installing

### Latest Releases

The latest WowUp release is always available on our website [wowup.io](https://wowup.io)

### Beta Releases

If you feel like helping us test the latest and greatest changes beta builds are available on [GitHub](https://github.com/WowUp/WowUp/releases)

### Community Support Alternatives

#### [WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/)

Ships with Windows 10 and 11.  You can install WowUp With Wago using:

```cmd
winget install wowup.wowup
```

Or Wowup with CurseForge with:

```cmd
winget install wowup.cf
```

#### [Chocolatey](https://chocolatey.org)

You can also install the latest version via Chocolatey package manager:

```cmd
choco install wowup
```

## Ascension Addon Authors

### Make an addon recognizable by WowUp

WowUp matches Ascension addons only by an explicit ID in a `.toc` file. To make an installed addon recognizable:

1. Add the following metadata line to the primary `.toc` file in each addon folder that should be recognized. Use the catalog addon's `id` as the value.

```text
## X-WowUp-Ascension-ID: elvui-ascension
```

2. Ensure the value exactly matches the catalog record's top-level `id`, such as `"id": "elvui-ascension"`. It is not the release `id`, version, folder name, or display name.
3. Publish the changed `.toc` file in every release ZIP. The `.toc` file must remain inside its addon directory at the ZIP root.
4. In WowUp, rescan the Ascension installation after replacing an existing addon. If it was previously assigned incorrectly, clear its Ascension assignments in Options and rescan.

For multi-folder addons, add the same metadata line to the primary `.toc` file in every folder listed in the release's `folders` field. The folder name must also be listed in that field so WowUp can associate it with the release.

Folder names, titles, authors, and versions are never used to identify Ascension addons. The metadata key must be written exactly as `X-WowUp-Ascension-ID`; shortened keys such as `X-WowUp-Asc` are not recognized.

### Publish addon ZIPs from GitHub

WowUp downloads and extracts the ZIP at a release's `downloadUrl`. Publish a GitHub Release asset rather than using GitHub's automatically generated source-code ZIP: a source archive usually adds a repository-name wrapper folder and includes files that are not part of the addon.

The release ZIP must contain each addon directory at its root, with its `.toc` file inside that directory. For example, `MyAscensionAddon-1.0.0.zip` should contain:

```text
MyAscensionAddon/
MyAscensionAddon/MyAscensionAddon.toc
MyAscensionAddon/...
```

Do not wrap the addon directory in another directory such as `my-repository-1.0.0/`. If an addon contains multiple folders, include each folder at the ZIP root and list every folder in the catalog release's `folders` field.

Create `.github/workflows/release.yml` in the addon repository. Replace `MyAscensionAddon` with the directory or directories that should be installed. This workflow runs only for `v*` Git tags, creates the correctly structured ZIP, and uploads it as a GitHub Release asset:

```yaml
name: Release addon

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build release ZIP
        env:
          VERSION: ${{ github.ref_name }}
        run: |
          VERSION="${VERSION#v}"
          mkdir dist
          zip -r "dist/MyAscensionAddon-${VERSION}.zip" MyAscensionAddon

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          files: dist/*.zip
```

Tag and push a release after committing the workflow and addon changes. The tag version and catalog `version` should match; the leading `v` is optional in the tag but is removed from the ZIP name above.

```bash
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```

After the workflow completes, use the uploaded asset URL in the catalog. With an owner of `example`, repository `my-ascension-addon`, tag `v1.0.0`, and the workflow above, the URL is:

```text
https://github.com/example/my-ascension-addon/releases/download/v1.0.0/MyAscensionAddon-1.0.0.zip
```

Set that URL as `downloadUrl`, set `version` to `1.0.0`, and set `folders` to `["MyAscensionAddon"]`. Test the URL in a private browser window before publishing the catalog record; it must download the ZIP without GitHub authentication.

## Contributing

We welcome any and all contributions from translations to feature pull requests.

Please read our [contribution guide](https://github.com/WowUp/WowUp/blob/master/CONTRIBUTING.md) to get started.

## Feedback

If you have a question, comment, or request we have several ways you can communicate them.

- Create a [bug or feature request](https://github.com/WowUp/WowUp/issues)
- Contact us on [Discord](https://discord.gg/rk4F5aD)

## Related Projects

We have a couple companion projects that are related to WowUp

- [Companion Addon](https://github.com/WowUp/WowUp.Addon)
- [App Updater](https://github.com/WowUp/WowUpUpdater) (Deprecated)

## Code of Conduct

Please read and understand our [Code of Coduct](https://github.com/WowUp/WowUp/blob/master/CODE_OF_CONDUCT.md) when submitting a bug or feature request here or on Discord.

## License

Copyright (c) WowUp LLC. All rights reserved.

Licensed under the [GNU General Public License v3.0](https://github.com/WowUp/WowUp/blob/master/LICENSE) license.
