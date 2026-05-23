import type { Config } from "../config.ts";
import { PiCorrespondenceAgent } from "./session.ts";
import {
  ScriptedCorrespondenceAgent,
  type CorrespondenceAgentRunner,
} from "./runner.ts";

export function createAgentRunner(config: Config): CorrespondenceAgentRunner {
  const usePi =
    Boolean(config.openRouterApiKey) &&
    process.env.CORRESPONDENCE_USE_PI_AGENT === "1";
  if (usePi) {
    return new PiCorrespondenceAgent(config);
  }
  return new ScriptedCorrespondenceAgent();
}

export { PiCorrespondenceAgent, ScriptedCorrespondenceAgent };
export type { CorrespondenceAgentRunner };
