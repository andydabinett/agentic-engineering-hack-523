import { createServer } from "node:net";

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => {
      probe.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(
  startPort: number,
  maxAttempts = 100,
): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset++) {
    const port = startPort + offset;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(
    `No available port found in range ${startPort}-${startPort + maxAttempts - 1}`,
  );
}
