import { afterEach, describe, expect, it } from "vitest";

import { createAgentRunner } from "../src/agent/index.ts";
import { PiCorrespondenceAgent } from "../src/agent/session.ts";
import { ScriptedCorrespondenceAgent } from "../src/agent/runner.ts";
import type { Config } from "../src/config.ts";

const baseConfig: Config = {
  port: 3001,
  publicBaseUrl: "http://localhost:3001",
  correspondenceDev: true,
  openRouterApiKey: "sk-test",
  twilioAccountSid: undefined,
  twilioAuthToken: undefined,
  twilioPhoneNumber: undefined,
  clickhouseHost: undefined,
  clickhousePort: 8443,
  clickhouseUser: "default",
  clickhousePassword: undefined,
  clickhouseDatabase: "javier",
  clickhouseSecure: true,
  googleClientId: undefined,
  googleClientSecret: undefined,
  googleRedirectUri: undefined,
  googleRefreshToken: undefined,
};

describe("createAgentRunner", () => {
  afterEach(() => {
    delete process.env.CORRESPONDENCE_USE_PI_AGENT;
  });

  it("uses scripted agent by default even when OpenRouter is set", () => {
    const agent = createAgentRunner(baseConfig);
    expect(agent).toBeInstanceOf(ScriptedCorrespondenceAgent);
  });

  it("uses Pi agent when CORRESPONDENCE_USE_PI_AGENT=1", () => {
    process.env.CORRESPONDENCE_USE_PI_AGENT = "1";
    const agent = createAgentRunner(baseConfig);
    expect(agent).toBeInstanceOf(PiCorrespondenceAgent);
  });

  it("uses scripted agent when OpenRouter is unset", () => {
    const agent = createAgentRunner({ ...baseConfig, openRouterApiKey: undefined });
    expect(agent).toBeInstanceOf(ScriptedCorrespondenceAgent);
  });
});
