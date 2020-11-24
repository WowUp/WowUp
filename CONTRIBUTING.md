# Contributing to WowUp

The following is a set of guidelines for contributing to WowUp, which is hosted in the [WowUp Organization](https://github.com/wowup) on GitHub. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

#### Table Of Contents

[Code of Conduct](#code-of-conduct)

[I don't want to read this whole thing, I just have a question!!!](#i-dont-want-to-read-this-whole-thing-i-just-have-a-question)

[What should I know before I get started?](#what-should-i-know-before-i-get-started)

[How Can I Contribute?](#how-can-i-contribute)

## Code of Conduct

This project and everyone participating in it is governed by the [WowUp Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [zakrn@wowup.io](mailto:zakrn@wowup.io).

## I don't want to read this whole thing I just have a question!!!

> **Note:** Please don't file an issue to ask a question. You'll get faster results by using the resources below.

We have an official discord with a detailed FAQ and where the community chimes in with helpful advice if you have questions.

* [WowUp FAQ](https://wowup.io/faq)

If chat is more your speed, you can join the WowUp Discord channel:

* [Join the WowUp Discord channel](https://discord.gg/rk4F5aD)
    * Even though Discord is a chat service, sometimes it takes several hours for community members to respond &mdash; please be patient!
    * Use the `#wowup-support` channel for general questions or help with WowUp
    * Use the `#suggestions` channel for feature suggestions
    * There are many other channels available, check the channel list

## What should I know before I get started?

WowUp is currently split into two code bases, the legacy 1.x C# client and the 2.x Electron/Angular client that we're moving forward with.

We are no longer adding features to the 1.x client as it will be sunset in favor of 2.x. 

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for WowUp. Following these guidelines helps maintainers and the community understand your report :pencil:, reproduce the behavior :computer: :computer:, and find related reports :mag_right:.

When you are creating a bug report, please include as many details as possible. Fill out Template coming soon, the information it asks for helps us resolve issues faster.

> **Note:** If you find a **Closed** issue that seems like it is the same thing that you're experiencing, open a new issue and include a link to the original issue in the body of your new one.

#### How Do I Submit A (Good) Bug Report?

Bugs are tracked as [GitHub issues](https://guides.github.com/features/issues/). Create an issue on and provide the following information by filling in [the template](https://github.com/atom/.github/blob/master/.github/ISSUE_TEMPLATE/bug_report.md).

Explain the problem and include additional details to help maintainers reproduce the problem:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible. For example, start by explaining how you started WowUp. When listing steps, **don't just say what you did, but explain how you did it**.
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**
* **Include screenshots and animated GIFs** which show you following the described steps and clearly demonstrate the problem. If you use the keyboard while following the steps. You can use [this tool](https://www.cockos.com/licecap/) to record GIFs on macOS and Windows, and [this tool](https://github.com/colinkeenan/silentcast) or [this tool](https://github.com/GNOME/byzanz) on Linux.
* **If the problem wasn't triggered by a specific action**, describe what you were doing before the problem happened and share more information using the guidelines below.

Provide more context by answering these questions:

* **Did the problem start happening recently** (e.g. after updating to a new version of WowUp) or was this always a problem?
* If the problem started happening recently, **can you reproduce the problem in an older version of WowUp?** What's the most recent version in which the problem doesn't happen? You can download older versions of WowUp from [the releases page](https://github.com/wowup/wowup/releases).
* **Can you reliably reproduce the issue?** If not, provide details about how often the problem happens and under which conditions it normally happens.

Include details about your configuration and environment:

* **Which version of WowUp are you using?** You can get the exact version by looking in the right hand corder of the application.
* **What's the name and version of the OS you're using**?


### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for WowUp, including completely new features and minor improvements to existing functionality. Following these guidelines helps maintainers and the community understand your suggestion :pencil: and find related suggestions :mag_right:.

Before creating enhancement suggestions, please check the existing feature requests as you might find out that you don't need to create one. When you are creating an enhancement suggestion, please [include as many details as possible](#how-do-i-submit-a-good-enhancement-suggestion). Fill in [the template](https://github.com/atom/.github/blob/master/.github/ISSUE_TEMPLATE/feature_request.md), including the steps that you imagine you would take if the feature you're requesting existed.

#### How Do I Submit A (Good) Enhancement Suggestion?

Enhancement suggestions are tracked as [GitHub issues](https://guides.github.com/features/issues/). Create an issue and provide the following information:

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Provide specific examples to demonstrate the steps**. Include copy/pasteable snippets which you use in those examples, as [Markdown code blocks](https://help.github.com/articles/markdown-basics/#multiple-lines).
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Include screenshots and animated GIFs** which help you demonstrate the steps or point out the part of WowUp which the suggestion is related to. You can use [this tool](https://www.cockos.com/licecap/) to record GIFs on macOS and Windows, and [this tool](https://github.com/colinkeenan/silentcast) or [this tool](https://github.com/GNOME/byzanz) on Linux.
* **Explain why this enhancement would be useful** to most WowUp users.

### Your First Code Contribution

Unsure where to begin contributing to WowUp? You can start by looking through these `help-wanted` issues:

* [Help wanted issues][help-wanted] - issues which should be a bit more involved than `beginner` issues.

#### Local development

WowUp can be developed locally. For instructions on how to do this, see the following sections in the [README](wowup-electron/README.md):

### Pull Requests

The process described here has several goals:

- Maintain WowUp's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible WowUp
- Enable a sustainable system for WowUp's maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. Follow all instructions in [the template](PULL_REQUEST_TEMPLATE.md)
2. Follow the [styleguides](#styleguides)
3. After you submit your pull request, verify that all [status checks](https://help.github.com/articles/about-status-checks/) are passing <details><summary>What if the status checks are failing?</summary>If a status check is failing, and you believe that the failure is unrelated to your change, please leave a comment on the pull request explaining why you believe the failure is unrelated. A maintainer will re-run the status check for you. If we conclude that the failure was a false positive, then we will open an issue to track that problem with our status check suite.</details>

While the prerequisites above must be satisfied prior to having your pull request reviewed, the reviewer(s) may ask you to complete additional design work, tests, or other changes before your pull request can be ultimately accepted.

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

### TypeScript Styleguide

All TypeScript code is linted with [Prettier](https://prettier.io/).

* Prefer the object spread operator (`{...anotherObj}`) to `Object.assign()`
* Place requires in the following order:
    * Built in Node Modules (such as `path`)
    * Built in Electron Modules (such as `remote`)
    * Local Modules (using relative paths)
* Place class properties in the following order:
    * Class methods and properties (methods starting with `static`)
    * Instance methods and properties

## Additional Notes

### Issue and Pull Request Labels

This section lists the labels we use to help us track and manage issues and pull requests.

The labels are loosely grouped by their purpose, but it's not required that every issue have a label from every group or that an issue can't have more than one label from the same group.

Please open an issue if you have suggestions for new labels, and if you notice some labels are missing on some repositories, then please open an issue on that repository.

## Attribution

This contributing guide is adapted from the [Contributing to Atom][atomguide].

[atomguide]: https://github.com/atom/atom/blob/master/CONTRIBUTING.md#before-submitting-a-bug-report