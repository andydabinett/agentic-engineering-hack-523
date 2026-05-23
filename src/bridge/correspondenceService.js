import path from "path";
import { pathToFileURL } from "url";

import { ROOT } from "../config/env.js";
import { importFromRoot, registerTsLoader } from "./tsLoader.js";

let servicePromise;

async function loadService() {
  if (!servicePromise) {
    await registerTsLoader();
    servicePromise = importFromRoot("src/correspondence/service.ts");
  }
  return servicePromise;
}

export async function startCorrespondence(input) {
  const service = await loadService();
  return service.startCorrespondenceThread(input);
}

export async function getCorrespondenceThread(threadId) {
  const service = await loadService();
  return service.getCorrespondenceThreadView(threadId);
}

export async function listCorrespondenceThreads(filters) {
  const service = await loadService();
  return service.listCorrespondenceThreadViews(filters);
}

export async function simulateCorrespondenceReply(threadId, body) {
  const service = await loadService();
  return service.simulateCorrespondenceThreadReply(threadId, body);
}

export async function processTwilioSmsWebhook(input) {
  const service = await loadService();
  return service.processTwilioSmsWebhook(input);
}

export async function twilioWebhookUrlForRequest(headers, pathSuffix = "/api/webhooks/twilio/sms") {
  const service = await loadService();
  const configMod = await importFromRoot("src/config.ts");
  return service.twilioWebhookUrlFromRequest(configMod.loadConfig(), headers, pathSuffix);
}

export {
  buildListingSummary,
  canStartCorrespondence,
  correspondenceDevEnabled,
  correspondenceFakeDemoEnabled,
  correspondenceForceDemoLister,
  demoListerPhone,
  resolveListerPhone,
  twilioConfiguredForCorrespondence,
  useDemoListerPhoneFallback,
} from "./correspondenceClient.js";
