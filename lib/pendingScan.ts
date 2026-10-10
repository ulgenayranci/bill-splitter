/**
 * Hand-off for "Retake" on the scan edit screen. The edit screen and the setup screen
 * never render together, and phones only open the camera from a tap on the visible
 * screen — so the edit screen picks the new photo itself, parks the File here, and
 * switches to setup, which takes it on mount and runs the normal scan.
 * In-memory only (a File can't be persisted).
 */
let pending: File | null = null

export function setPendingScanFile(file: File): void {
  pending = file
}

/** Returns the parked photo once (then clears it), or null. */
export function takePendingScanFile(): File | null {
  const file = pending
  pending = null
  return file
}
