export function nodeMajorVersion(): number {
  return Number(process.versions.node.split(".")[0] || "0");
}

export function requireNode22(feature = "This API"): string | null {
  if (nodeMajorVersion() < 22) {
    return `${feature} requires Node.js 22+ (node:sqlite). Stop the dev server, run \`nvm use\` from the repo root, then restart.`;
  }
  return null;
}
