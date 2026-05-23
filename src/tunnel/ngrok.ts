export interface NgrokTunnel {
  publicUrl: string;
  proto: string;
}

export interface NgrokApiResponse {
  tunnels?: Array<{ public_url: string; proto: string }>;
}

export function pickNgrokTunnel(tunnels: NgrokTunnel[]): NgrokTunnel | undefined {
  return tunnels.find((tunnel) => tunnel.proto === "https") ?? tunnels[0];
}

export function parseNgrokResponse(data: NgrokApiResponse): NgrokTunnel[] {
  return (data.tunnels ?? []).map((tunnel) => ({
    publicUrl: tunnel.public_url.replace(/\/$/, ""),
    proto: tunnel.proto,
  }));
}

export async function getNgrokPublicUrl(
  apiUrl = "http://127.0.0.1:4040/api/tunnels",
  options?: { retries?: number; delayMs?: number },
): Promise<string> {
  const retries = options?.retries ?? 20;
  const delayMs = options?.delayMs ?? 500;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`ngrok API returned ${response.status}`);
      }

      const data = (await response.json()) as NgrokApiResponse;
      const tunnel = pickNgrokTunnel(parseNgrokResponse(data));
      if (tunnel?.publicUrl) {
        return tunnel.publicUrl;
      }

      throw new Error("ngrok is running but no tunnels were found");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(
    `${lastError?.message ?? "Could not read ngrok public URL"}. Start ngrok first, e.g. ngrok http 3001`,
  );
}
