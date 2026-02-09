/**
 * Safely retrieves the user's current geolocation.
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.timeout=8000] - Maximum time to wait for location (ms).
 * @param {number} [options.maximumAge=60000] - Maximum age of cached position (ms).
 * @param {boolean} [options.enableHighAccuracy=true] - Request high accuracy if possible.
 * @returns {Promise<{latitude: number, longitude: number, accuracyMeters: number, capturedAt: string} | null>}
 */
function toLocationPayload(pos) {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracyMeters: pos.coords.accuracy,
    capturedAt: new Date(pos.timestamp).toISOString(),
  };
}

export async function getCurrentLocationDetails({
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
    return pos;
  }

  try {
    if (!("geolocation" in navigator)) {
      return { ok: false, location: null, code: "UNSUPPORTED", message: "Geolocation is not supported on this device/browser." };
    }

    const perm = await navigator.permissions?.query?.({ name: "geolocation" }).catch(() => null);
    if (perm?.state === "denied") {
      return { ok: false, location: null, code: "DENIED", message: "Location permission is denied." };
    }

    try {
      const pos = await run(enableHighAccuracy);
      return { ok: true, location: toLocationPayload(pos), code: null, message: "" };
    } catch (e) {
      // retry once with low accuracy if high-accuracy fails
      if (enableHighAccuracy) {
        try {
          const pos2 = await run(false);
          return { ok: true, location: toLocationPayload(pos2), code: null, message: "" };
        } catch (e2) {
          const code = Number(e2?.code);
          if (code === 1) return { ok: false, location: null, code: "DENIED", message: "Location permission is denied." };
          if (code === 2) return { ok: false, location: null, code: "UNAVAILABLE", message: "Unable to determine current location." };
          if (code === 3) return { ok: false, location: null, code: "TIMEOUT", message: "Location request timed out. Please retry." };
          return { ok: false, location: null, code: "FAILED", message: "Failed to capture location." };
        }
      }
      const code = Number(e?.code);
      if (code === 1) return { ok: false, location: null, code: "DENIED", message: "Location permission is denied." };
      if (code === 2) return { ok: false, location: null, code: "UNAVAILABLE", message: "Unable to determine current location." };
      if (code === 3) return { ok: false, location: null, code: "TIMEOUT", message: "Location request timed out. Please retry." };
      return { ok: false, location: null, code: "FAILED", message: "Failed to capture location." };
    }
  } catch (e) {
    console.warn("Location unavailable:", e);
    return { ok: false, location: null, code: "FAILED", message: "Failed to capture location." };
  }
}

export async function getCurrentLocation(options = {}) {
  const result = await getCurrentLocationDetails(options);
  return result.ok ? result.location : null;
}
