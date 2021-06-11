export function formatDynamicLinks(container: HTMLDivElement, onClick: (element: HTMLAnchorElement) => boolean): void {
  if (!container) {
    return;
  }

  const aTags = container.getElementsByTagName("a");
  for (const tag of Array.from(aTags)) {
    if (tag.getAttribute("clk")) {
      continue;
    }

    if (tag.href.toLowerCase().indexOf("http") === -1 || tag.href.toLowerCase().indexOf("localhost") !== -1) {
      tag.classList.add("no-link");
    }

    tag.setAttribute("clk", "1");
    tag.addEventListener(
      "click",
      (e: MouseEvent) => {
        console.debug("CLICK");
        const anchor = onOpenLink(e);
        if (anchor === undefined) {
          return;
        }

        onClick.call(null, anchor);
      },
      false
    );
  }
}

function onOpenLink(e: MouseEvent): HTMLAnchorElement | undefined {
  e.preventDefault();

  // Go up the call chain to find the tag
  const path = (e as any).path as HTMLElement[];
  let anchor: HTMLAnchorElement | undefined = undefined;
  for (const element of path) {
    if (element.tagName !== "A") {
      continue;
    }

    anchor = element as HTMLAnchorElement;
    break;
  }

  if (!anchor) {
    console.warn("No anchor in path");
    return undefined;
  }

  if (anchor.href.toLowerCase().indexOf("http") !== 0 || anchor.href.toLowerCase().indexOf("localhost") !== -1) {
    console.warn(`Unhandled relative path: ${anchor.href}`);
    return undefined;
  }

  return anchor;
}
