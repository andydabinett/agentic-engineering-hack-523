import { loadChatAgent } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { handleChatRequest } = await loadChatAgent();
    return handleChatRequest(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
