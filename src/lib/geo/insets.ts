// Alaska and Hawaii are drawn as insets below the Southwest, as on most US
// maps. Each moves from its own center to a spot off Baja, Alaska shrunk;
// longitudes are rescaled by the cosine ratio so shapes survive the move to
// a lower latitude.
export const INSETS: Record<string, { from: [number, number]; to: [number, number]; scale: number }> = {
  "02": { from: [-152, 62], to: [-117, 25.5], scale: 0.33 },
  "15": { from: [-157, 20.5], to: [-106, 24.5], scale: 1 },
};

export function insetPosition(stateId: string, lon: number, lat: number): [number, number] {
  const inset = INSETS[stateId];
  if (!inset) return [lon, lat];
  const x = lon > 0 ? lon - 360 : lon; // Aleutians west of the antimeridian
  const toRadians = Math.PI / 180;
  const squash = Math.cos(inset.from[1] * toRadians) / Math.cos(inset.to[1] * toRadians);
  return [
    inset.to[0] + (x - inset.from[0]) * inset.scale * squash,
    inset.to[1] + (lat - inset.from[1]) * inset.scale,
  ];
}
