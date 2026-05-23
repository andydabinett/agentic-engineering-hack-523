/** @type {boolean} */
let runtimeFakeDemo = false;

export function correspondenceFakeDemoEnabled() {
  return process.env.CORRESPONDENCE_FAKE_DEMO === "1" || runtimeFakeDemo;
}

/** Dev-only: Twilio overload → fake SMS + scripted broker replies for rest of process. */
export function activateRuntimeFakeDemo(reason) {
  if (runtimeFakeDemo) return;
  runtimeFakeDemo = true;
  console.warn(
    `[correspondence] Twilio unavailable (${reason}) — switching to full fake SMS demo`,
  );
}

export function resetRuntimeFakeDemoForTests() {
  runtimeFakeDemo = false;
}
