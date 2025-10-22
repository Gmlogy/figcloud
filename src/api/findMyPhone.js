import { api } from "@/lib/api";

/**
 * Ask backend to ring the device(s).
 */
export function ringDevice(opts = {}) {
  // The 'userId' is now expected in the 'opts' object
  return api.post("/fmp/ring", opts);
}

/**
 * Ask backend to stop ringing the device.
 */
export function stopRingDevice(opts = {}) {
    // The 'userId' is now expected in the 'opts' object
  return api.post("/fmp/stop-ring", opts);
}

/**
 * Start a locate request.
 */
export function locateStart(userId) {
  // Now sends the userId in the request body
  return api.post("/fmp/locate", { userId });
}

/**
 * Poll the locate result by requestId.
 */
export function locatePoll(requestId) {
  return api.get(`/fmp/locate/${encodeURIComponent(requestId)}`);
}