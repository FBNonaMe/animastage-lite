const defaultCameraNameMatcher = (name) => /camera|カメラ/iu.test(String(name || ""));

/**
 * Pick the first camera VMD that may be activated without replacing an
 * explicitly active camera. This remains pure so batch import, ZIP import and
 * session restore can share the same non-destructive rule.
 */
export function selectCameraVmdForAutoActivation(
  files,
  { activeEnabled = false, activeName = "", matchesCamera = defaultCameraNameMatcher } = {},
) {
  if (activeEnabled && String(activeName || "").trim()) return null;
  if (typeof matchesCamera !== "function") throw new TypeError("matchesCamera must be a function");
  for (const file of Array.from(files || [])) {
    if (file && matchesCamera(file.name)) return file;
  }
  return null;
}
