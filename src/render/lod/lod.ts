/**
 * Drawing by error in pixels: every object is drawn in the simplest form whose difference from the full one would
 * show as at most τ pixels on screen. Far things become simpler on their own, so what a frame costs depends on the
 * screen, not on how much the scene holds. τ adapts to the device: when frames get slow it grows, when they are
 * fast it shrinks back. Beyond the fog nothing is drawn. A change of form fades in (fade.ts) and needs a margin
 * past the threshold, so nothing flickers at a boundary. The full mesh stays where it is for picking; it just isn't
 * drawn while a simpler form is.
 */
import * as THREE from "three";
import type { Store } from "@/app/store";
import type { Obj } from "@/world/model";
import { buildGeometry, disposeGeometry } from "../geometry";
import { FOG_FAR } from "../scene";
import type { ObjView } from "../objects";
import type { Part } from "./fade";
import { Crossfade } from "./fade";
import type { Form } from "./forms";
import { MARGIN, nextForm } from "./forms";
import { Simplifier } from "./simplifier";

/** drawn by neither the camera nor the shadows; picking still sees it (picking.ts enables it) */
export const HIDDEN_LAYER = 5;
/** below this many triangles a simpler version isn't worth making */
const MIN_SIMPLE_TRIS = 1000;
/** how far from the real shape the simpler version may be, as a share of the object's size */
const SIMPLE_ERROR = 0.01;
/** a box stands in only for what is a few pixels across anyway */
const BOX_PX = 3;
const SLOW_S = 1 / 30;
const FAST_S = 1 / 50;
const MAX_TAU_PX = 4;

interface Forms {
  geometry: string;
  simple: THREE.Mesh | null;
  wanted: boolean;
  box: THREE.Mesh;
  /** the object's size in the world, m */
  diag: number;
  form: Form;
  /** when the form last changed, s */
  changed: number;
  /** not drawn yet: the first form comes without a fade */
  fresh: boolean;
}

const v3 = new THREE.Vector3();
const now = () => performance.now() / 1000;

export class Lod {
  private forms = new Map<string, Forms>();
  private simplifier = new Simplifier();
  private fade: Crossfade;
  private tau: number;
  private slow = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly store: Store,
    private readonly baseTau = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches ? 2 : 1,
  ) {
    this.tau = baseTau;
    this.fade = new Crossfade(scene);
  }

  update(views: Map<string, ObjView>, camera: THREE.PerspectiveCamera, heightPx: number, dt: number): void {
    this.adapt(dt);
    const pxPerM = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    // fades that end now end before the forms are placed, so no frame shows neither
    this.fade.tick((id) => views.get(id)?.mesh.matrixWorld ?? null);
    for (const [id, v] of views) this.place(id, v, camera, pxPerM);
    for (const [id, f] of this.forms) if (!views.has(id)) this.drop(id, f);
  }

  private adapt(dt: number): void {
    this.slow = this.slow * 0.9 + dt * 0.1;
    if (this.slow > SLOW_S) this.tau = Math.min(MAX_TAU_PX, this.tau * 1.02);
    else if (this.slow < FAST_S) this.tau = Math.max(this.baseTau, this.tau / 1.01);
  }

  private place(id: string, v: ObjView, camera: THREE.PerspectiveCamera, pxPerM: number): void {
    const o = this.store.byId(id);
    const f = this.formsOf(id, v);
    const keepFull = !o || o.hidden || this.store.selection.objects.has(id);
    const geo = v.mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const centre = v3.copy(geo.boundingSphere!.center).applyMatrix4(v.mesh.matrixWorld);
    const dist = camera.position.distanceTo(centre);
    const px = pxPerM / Math.max(0.01, dist);
    if (keepFull) return this.show(id, v, f, "full");
    const lenient = this.choose(id, o!, f, { px, dist }, 1);
    const strict = this.choose(id, o!, f, { px, dist }, MARGIN);
    this.show(id, v, f, nextForm(f.form, lenient, strict, now() - f.changed));
  }

  /** the coarsest form allowed, with the error and the fog shrunk by `k` (< 1: with a margin) */
  private choose(id: string, o: Obj, f: Forms, { px, dist }: { px: number; dist: number }, k: number): Form {
    if (dist - f.diag / 2 > FOG_FAR / k) return "gone";
    if (f.diag * px <= BOX_PX * this.tau * k) return "box";
    if (f.wanted && f.diag * SIMPLE_ERROR * px <= this.tau * k) return this.simpleOrFull(id, o, f);
    return "full";
  }

  private simpleOrFull(id: string, o: Obj, f: Forms): Form {
    if (f.simple) return "simple";
    const key = f.geometry;
    this.simplifier.request(id, key, o.mesh, (mesh) => {
      const now = this.forms.get(id);
      if (!now || now.geometry !== key) return;
      // no faithful simpler version of this mesh: it stays in full, and isn't asked for again
      if (!mesh) return void (now.wanted = false);
      const g = buildGeometry(mesh, this.store.settings.smoothAngleDegrees, o.size);
      now.simple = this.coarse(g);
    });
    return "full";
  }

  private formsOf(id: string, v: ObjView): Forms {
    const geo = v.mesh.geometry;
    let f = this.forms.get(id);
    if (f && f.geometry === geo.uuid) return f;
    const was = f?.form;
    if (f) this.drop(id, f);
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const size = bb.getSize(new THREE.Vector3()).multiply(v.mesh.scale);
    const box = new THREE.BoxGeometry(...bb.getSize(new THREE.Vector3()).toArray()).translate(
      ...bb.getCenter(new THREE.Vector3()).toArray(),
    );
    const tris = (geo.index ? geo.index.count : geo.getAttribute("position").count) / 3;
    f = {
      geometry: geo.uuid,
      simple: null,
      wanted: tris >= MIN_SIMPLE_TRIS && this.simplifier.available,
      box: this.coarse(box),
      diag: size.length(),
      // rebuilt (edited, or changed by a script): it goes on as it was, without a fade
      form: was === "simple" ? "full" : (was ?? "full"),
      changed: now(),
      fresh: true,
    };
    this.forms.set(id, f);
    return f;
  }

  private coarse(g: THREE.BufferGeometry): THREE.Mesh {
    const m = new THREE.Mesh(g);
    m.castShadow = m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.visible = false;
    m.raycast = () => {};
    this.scene.add(m);
    return m;
  }

  /** a new form fades in over the old one (but not the first form, nor for what isn't shown) */
  private change(id: string, v: ObjView, f: Forms, form: Form): void {
    if (!v.mesh.visible) this.fade.stop(id);
    else if (form !== f.form && !f.fresh)
      this.fade.start(id, this.part(v, f, f.form), this.part(v, f, form), v.mesh.matrixWorld);
    if (form !== f.form) f.changed = now();
    f.form = form;
    f.fresh = false;
  }

  private show(id: string, v: ObjView, f: Forms, form: Form): void {
    this.change(id, v, f, form);
    const fading = this.fade.has(id);
    v.mesh.layers.set(form === "full" && !fading ? 0 : HIDDEN_LAYER);
    for (const [m, as] of [
      [f.simple, "simple"],
      [f.box, "box"],
    ] as const) {
      if (!m) continue;
      m.visible = form === as && v.mesh.visible && !fading;
      if (!m.visible) continue;
      m.matrix.copy(v.mesh.matrixWorld);
      m.matrixWorld.copy(v.mesh.matrixWorld);
      m.material = this.part(v, f, as)!.material;
    }
  }

  /** what a form draws: its geometry, with the object's materials (the box: the first one) */
  private part(v: ObjView, f: Forms, form: Form): Part | null {
    const mats = v.mesh.material as THREE.Material | THREE.Material[];
    if (form === "full") return { geometry: v.mesh.geometry, material: mats };
    if (form === "simple") return f.simple && { geometry: f.simple.geometry, material: mats };
    if (form === "box") return { geometry: f.box.geometry, material: Array.isArray(mats) ? mats[0] : mats };
    return null;
  }

  private drop(id: string, f: Forms): void {
    this.fade.stop(id);
    for (const m of [f.simple, f.box]) {
      if (!m) continue;
      this.scene.remove(m);
      disposeGeometry(m.geometry);
    }
    this.forms.delete(id);
  }
}
