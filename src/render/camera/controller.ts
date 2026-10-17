/**
 * The camera: the view swings around a point you click.
 * `focus`/`offset` are the target; `shownFocus`/`shownOffset` ease towards them every frame.
 */
import * as THREE from "three";
import { fitShadow } from "../scene";

const DEG = Math.PI / 180;
const HALF_LIFE_S = 0.08;
const MIN_OFFSET_M = 0.05;
const FOLLOW_DIST_RANGE_M: [number, number] = [1.5, 40];
const MAX_DISTANCE_M = 1200;
/** how far back the sun stands, in shadow half widths */
const SUN_BACK_K = 1.5;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export interface CameraDeps {
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  sun: THREE.DirectionalLight;
  sunOffset: THREE.Vector3;
}

export class CameraController {
  readonly focus = new THREE.Vector3(0, 0, 1.2);
  readonly offset = new THREE.Vector3(9, -11, 7);
  readonly shownFocus = new THREE.Vector3(0, 0, 1.2);
  readonly shownOffset = new THREE.Vector3(9, -11, 7);
  /** the object the view is centred on, if any: zooming in may come closer to it */
  focusObj: string | null = null;
  /** camera rides behind the avatar until you move it yourself */
  follow = false;
  followDist = 4.2;

  constructor(private readonly deps: CameraDeps) {}

  get camera(): THREE.PerspectiveCamera {
    return this.deps.camera;
  }

  /** camera stays where it is; the view turns to the new point */
  setFocus(point: THREE.Vector3, objId?: string | null): void {
    this.follow = false;
    const camPos = this.focus.clone().add(this.offset);
    this.focus.copy(point);
    this.offset.copy(camPos.sub(point));
    this.focusObj = objId ?? null;
    if (this.offset.length() < MIN_OFFSET_M) this.offset.setLength(MIN_OFFSET_M);
  }

  zoomIn(fraction: number): void {
    if (this.follow) {
      this.followDist = clamp(this.followDist * fraction, ...FOLLOW_DIST_RANGE_M);
      return;
    }
    const d = this.offset.length();
    const nearest = this.focusObj ? 0.04 : 0.15;
    this.offset.setLength(clamp(d * fraction, nearest, Math.min(MAX_DISTANCE_M, d * 4)));
  }

  setDistance(metres: number): void {
    this.offset.setLength(metres);
  }

  orbitAround(rad: number): void {
    this.follow = false;
    this.offset.applyAxisAngle(new THREE.Vector3(0, 0, 1), rad);
  }

  orbitOver(rad: number): void {
    this.follow = false;
    const r = this.offset.length();
    const u = this.offset.clone().normalize();
    const polar = clamp(Math.acos(clamp(u.z, -1, 1)) - rad, 1 * DEG, 179 * DEG);
    const azimuth = Math.atan2(u.y, u.x);
    this.offset
      .set(Math.sin(polar) * Math.cos(azimuth), Math.sin(polar) * Math.sin(azimuth), Math.cos(polar))
      .multiplyScalar(r);
  }

  /** drag the view sideways by screen pixels; the shown camera moves with it, so a pan never lags */
  pan(dx: number, dy: number): void {
    this.follow = false;
    const { camera, canvas } = this.deps;
    const metresPerPixel = (2 * this.offset.length() * Math.tan((camera.fov * DEG) / 2)) / (canvas.clientHeight || 1);
    const left = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).negate();
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const v = left.multiplyScalar(dx * metresPerPixel).add(up.multiplyScalar(dy * metresPerPixel));
    this.focus.add(v);
    this.shownFocus.add(v);
    this.shownOffset.copy(this.offset);
  }

  /** look at `centre` from `direction`, `distance` away */
  lookAt(centre: THREE.Vector3, direction: THREE.Vector3 | undefined, distance: number, objId: string | null): void {
    this.follow = false;
    this.focus.copy(centre);
    this.offset.copy(direction ?? this.offset).setLength(distance);
    this.focusObj = objId;
  }

  /** per frame: ease towards the target and keep the sun over what we look at */
  update(dt: number): void {
    const k = 1 - Math.pow(2, -dt / HALF_LIFE_S);
    this.shownFocus.lerp(this.focus, k);
    this.shownOffset.lerp(this.offset, k);
    const { camera, sun, sunOffset } = this.deps;
    camera.position.copy(this.shownFocus).add(this.shownOffset);
    camera.lookAt(this.shownFocus);
    camera.updateMatrixWorld();
    const extent = fitShadow(sun, this.shownOffset.length());
    const back = Math.max(1, (extent * SUN_BACK_K) / sunOffset.length());
    sun.position.copy(this.shownFocus).addScaledVector(sunOffset, back);
    sun.target.position.copy(this.shownFocus);
    sun.target.updateMatrixWorld();
  }

  /** jump to the target without easing (boot, teleports) */
  snap(): void {
    this.shownFocus.copy(this.focus);
    this.shownOffset.copy(this.offset);
  }
}
