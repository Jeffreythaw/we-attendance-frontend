/**
 * Safely retrieves the user's current geolocation.
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.timeout=8000] - Maximum time to wait for location (ms).
 * @param {number} [options.maximumAge=60000] - Maximum age of cached position (ms).
 * @param {boolean} [options.enableHighAccuracy=true] - Request high accuracy if possible.
 * @returns {Promise<{latitude: number, longitude: number, accuracyMeters: number, capturedAt: string} | null>}
 */
export async function getCurrentLocation({
  timeout = 8000,
  maximumAge = 60_000,
  enableHighAccuracy = true,
} = {}) {
  async function run(highAcc) {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: highAcc,
        timeout,
        maximumAge,
      });
    });

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracyMeters: pos.coords.accuracy,
      capturedAt: new Date(pos.timestamp).toISOString(),
    };
  }

  try {
    if (!("geolocation" in navigator)) return null;

    const perm = await navigator.permissions?.query?.({ name: "geolocation" }).catch(() => null);
    if (perm?.state === "denied") return null;

    try {
      return await run(enableHighAccuracy);
    } catch (e) {
      // retry once with low accuracy if high-accuracy fails
      if (enableHighAccuracy) return await run(false);
      throw e;
    }
  } catch (e) {
    console.warn("Location unavailable:", e);
    return null;
  }
}