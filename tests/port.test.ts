import { describe, expect, it } from "vitest";

import { findAvailablePort, isPortAvailable } from "../src/port.ts";

describe("findAvailablePort", () => {
  it("returns start port when available", async () => {
    const port = await findAvailablePort(45678);
    expect(port).toBe(45678);
    expect(await isPortAvailable(45678)).toBe(true);
  });

  it("increments until an available port is found", async () => {
    const port = await findAvailablePort(45679, 10);
    expect(port).toBeGreaterThanOrEqual(45679);
    expect(port).toBeLessThan(45689);
    expect(await isPortAvailable(port)).toBe(true);
  });
});
