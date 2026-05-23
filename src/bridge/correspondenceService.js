import path from "path";
import { pathToFileURL } from "url";

import { ROOT } from "../config/env.js";

let servicePromise;

async function loadService() {
  if (!servicePromise) {
    servicePromise = import(
      pathToFileURL(path.join(ROOT, "src/correspondence/service.ts")).href
    );
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

export async function twilioWebhookUrlForRequest(headers, path = "/api/webhooks/twilio/sms") {
  const service = await loadService();
  const configMod = await import(
    pathToFileURL(path.join(ROOT, "src/config.ts")).href
  );
  return service.twilioWebhookUrlFromRequest(configMod.loadConfig(), headers, path);
}

export async function correspondenceDevEnabled() {
  const service = await loadService();
  return service.correspondenceDevEnabled();
}

export {
  buildListingSummary,
  canStartCorrespondence,
  correspondenceFakeDemoEnabled,
  demoListerPhone,
  twilioConfiguredForCorrespondence,
} from "./correspondenceClient.js";
