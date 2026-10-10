import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { clip, decodeClip, meanHipsY, sampleBone } from "./clips";

const encode = (values: number[]) => btoa(String.fromCharCode(...new Uint8Array(new Int16Array(values).buffer)));

/** frames of one bone: rest, rest, bent, bent, rest */
function paddedClip(loop: boolean) {
  const rest = [0, 0, 0, 32767];
  const bent = [0, 0, 23170, 23170]; // 90° about Z
  const frames = [rest, rest, bent, bent, rest];
  return {
    fps: 10,
    n: frames.length,
    loop,
    hips: encode(frames.flatMap(() => [0, 10000, 0])),
    bones: { leftUpperArm: encode(frames.flat()) },
  };
}

describe("clip decoding", () => {
  it("trims rest-pose frames off both ends of one-shot clips", () => {
    const c = decodeClip("test", paddedClip(false));
    expect(c.n).toBe(2);
    expect(c.dur).toBeCloseTo(0.1);
    const q = new THREE.Quaternion();
    expect(sampleBone(c, "leftUpperArm", 0, q)).toBe(true);
    expect(q.angleTo(new THREE.Quaternion())).toBeCloseTo(Math.PI / 2, 3);
  });

  it("leaves loops whole", () => {
    const c = decodeClip("test", paddedClip(true));
    expect(c.n).toBe(5);
    expect(c.dur).toBeCloseTo(0.5);
  });

  it("reads the shipped clips", () => {
    const idle = clip("idle")!;
    expect(idle.loop).toBe(true);
    expect(clip("nope")).toBeNull();
    expect(clip("_source")).toBeNull();
    expect(meanHipsY("sit")).toBeLessThan(0.9);
  });
});
