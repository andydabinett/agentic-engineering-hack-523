import type { Config } from "../config.ts";
import { PiCorrespondenceAgent } from "./session.ts";
import {
  ScriptedCorrespondenceAgent,
  type CorrespondenceAgentRunner,
} from "./runner.ts";

export function createAgentRunner(config: Config): CorrespondenceAgentRunner {
  if (config.openRouterApiKey) {
    return new PiCorrespondenceAgent(config);
  }
  return new ScriptedCorrespondenceAgent();
}

export { PiCorrespondenceAgent, ScriptedCorrespondenceAgent };
export type { CorrespondenceAgentRunner };
