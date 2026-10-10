/** A rolling ball turns about the axis across its motion: one full turn per circumference travelled. */
import type { Quat, Vec3 } from "@/lib/vec";

export function rollQuat(q: Quat, vel: Vec3, radius: number, dt: number): Quat {
  const speed = Math.hypot(vel[0], vel[1]);
  if (speed < 1e-4 || radius <= 0) return q;
  // axis = up × velocity, in the ground plane
  const axis: Vec3 = [-vel[1] / speed, vel[0] / speed, 0];
  const half = (speed * dt) / radius / 2;
  const s = Math.sin(half);
  return normalizeQuat(mulQuat([axis[0] * s, axis[1] * s, 0, Math.cos(half)], q));
}

function mulQuat(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function normalizeQuat(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
