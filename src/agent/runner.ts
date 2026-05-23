import type { CorrespondenceOrchestrator } from "../services/correspondence/orchestrator.ts";

export interface CorrespondenceAgentRunner {
  run(
    orchestrator: CorrespondenceOrchestrator,
    threadId: string,
    instruction: string,
  ): Promise<void>;
}

/** Deterministic agent for tests and offline demo without LLM. */
export class ScriptedCorrespondenceAgent implements CorrespondenceAgentRunner {
  async run(
    orchestrator: CorrespondenceOrchestrator,
    threadId: string,
    instruction: string,
  ): Promise<void> {
    const context = await orchestrator.getThreadContext(threadId);
    const lowerInstruction = instruction.toLowerCase();
    const lowerContext = context.toLowerCase();

    if (lowerInstruction.includes("start outreach") || lowerContext.includes("status: initiated")) {
      await orchestrator.sendSms(
        threadId,
        "Hi! I'm Javier, helping schedule a viewing for your listing. Are you available this week for a tour?",
      );
      return;
    }

    if (lowerContext.includes("inbound:")) {
      const lastInbound = [...context.split("\n")]
        .reverse()
        .find((line) => line.startsWith("INBOUND:"))
        ?.replace("INBOUND:", "")
        .trim()
        .toLowerCase();

      if (lastInbound && /\b(yes|yeah|sure|works|confirm|ok)\b/.test(lastInbound)) {
        const start = new Date(Date.now() + 86_400_000);
        start.setHours(14, 0, 0, 0);
        const end = new Date(start.getTime() + 3_600_000);
        await orchestrator.sendSms(
          threadId,
          `Great — I've scheduled the viewing for ${start.toLocaleString()}. See you then!`,
        );
        await orchestrator.bookViewing(threadId, {
          title: "Apartment viewing",
          start: start.toISOString(),
          end: end.toISOString(),
          description: "Scheduled by Javier correspondence agent",
        });
        return;
      }

      await orchestrator.sendSms(
        threadId,
        "Thanks! Would tomorrow at 2pm work for a viewing?",
      );
    }
  }
}
