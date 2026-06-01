const BROWSER_NAVIGATION_COMMAND_PATTERN =
  /^(?:(打开|访问|浏览|跳转|进入)\s*|(open|visit|navigate|go to)\s+)(.+)$/i;

const DOMAIN_OR_URL_PATTERN =
  /^(https?:\/\/[^\s，。！？,!?]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s，。！？,!?]*)?)$/i;

function normalizeBrowserNavigationTarget(target: string): string {
  return target.trim().replace(/[，。！？,!?]+$/g, "");
}

function resolveKnownBrowserDestination(target: string): string | null {
  if (/^(百度|baidu)$/i.test(target)) {
    return "https://www.baidu.com/";
  }
  return null;
}

export function resolveBrowserNavigationUrl(text: string): string | null {
  const compactText = text.replace(/\s+/g, " ").trim();
  if (!compactText) {
    return null;
  }

  const directKnownDestination = resolveKnownBrowserDestination(compactText);
  if (directKnownDestination) {
    return directKnownDestination;
  }

  const commandMatch = compactText.match(BROWSER_NAVIGATION_COMMAND_PATTERN);
  if (!commandMatch) {
    return null;
  }

  const target = normalizeBrowserNavigationTarget(commandMatch[3] ?? "");
  if (!target) {
    return null;
  }

  const knownDestination = resolveKnownBrowserDestination(target);
  if (knownDestination) {
    return knownDestination;
  }

  if (!DOMAIN_OR_URL_PATTERN.test(target)) {
    return null;
  }

  return /^https?:\/\//i.test(target) ? target : `https://${target}`;
}
