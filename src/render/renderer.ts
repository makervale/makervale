/** The three.js side of the app, put together: scene, camera, object views, highlights, picking, sky, bubbles. */
import * as THREE from "three";
import type { Bus } from "@/app/bus";
import type { Store } from "@/app/store";
import type { Mesh } from "@/lib/mesh/mesh";
import type { EditMode } from "@/lib/mesh/selection";
import { Bubbles } from "./bubbles/bubbles";
import { CameraController } from "./camera/controller";
import { Framing } from "./camera/framing";
import { installBvh } from "./geometry";
import { Highlights } from "./highlights";
import { MaterialCache } from "./materials";
import { ObjectViews } from "./objects";
import type { ElementPick } from "./preselect";
import { Preselection } from "./preselect";
import { pickElement } from "./pick-element";
import type { Rect } from "./pick-rect";
import { elementsInRect } from "./pick-rect";
import { Picker } from "./picking";
import type { SceneParts } from "./scene";
import { createScene } from "./scene";
import { Sky } from "./sky";
import type { Theme } from "./theme";
import { readTheme } from "./theme";
import { Lod } from "./lod/lod";

export interface RendererDeps {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
  store: Store;
  bus: Bus;
  revisionOf(mesh: Mesh): number;
}

const MAX_PIXEL_RATIO = 2;

export class Renderer {
  readonly parts: SceneParts;
  readonly webgl: THREE.WebGLRenderer;
  readonly theme: Theme;
  readonly views: ObjectViews;
  readonly lod: Lod;
  readonly camera: CameraController;
  readonly framing: Framing;
  readonly picker: Picker;
  readonly highlights: Highlights;
  readonly preselect: Preselection;
  readonly sky: Sky;
  readonly bubbles: Bubbles;

  constructor(private readonly deps: RendererDeps) {
    installBvh();
    this.parts = createScene();
    this.theme = readTheme();
    this.webgl = createWebGL(deps.canvas);
    const { store, revisionOf } = deps;
    this.views = new ObjectViews({ scene: this.parts.scene, store, revisionOf, materials: new MaterialCache() });
    this.lod = new Lod(this.parts.scene, store);
    const { camera, sun, sunOffset } = this.parts;
    this.camera = new CameraController({ camera, canvas: deps.canvas, sun, sunOffset });
    this.framing = new Framing(this.camera, this.views);
    this.picker = new Picker(deps.canvas, this.parts.camera, this.views, this.parts.ground);
    this.highlights = new Highlights({ store, views: this.views, theme: this.theme, revisionOf });
    this.preselect = new Preselection(this.parts.scene, this.views, this.theme);
    this.sky = new Sky(this.parts, setSkyColors);
    this.bubbles = new Bubbles(this.parts.scene);
    this.listen();
    new ResizeObserver(() => this.resize()).observe(deps.stage);
  }

  get scene(): THREE.Scene {
    return this.parts.scene;
  }

  /** solid things the avatar collides with and stands on; balls are not: walking into one kicks it */
  solids(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [this.parts.ground];
    for (const [id, v] of this.views.views) {
      if (v.mesh.visible && !this.deps.store.byId(id)?.body) out.push(v.mesh);
    }
    return out;
  }

  pickElement(x: number, y: number, mode?: EditMode): ElementPick | null {
    return pickElement(this.elementDeps(), x, y, mode);
  }

  elementsInRect(rect: Rect): ElementPick[] {
    return elementsInRect(this.elementDeps(), rect);
  }

  /** ease the camera, move the sky, spin spinning things; `skyDt` may run longer than a capped frame */
  advance(dt: number, skyDt = dt): void {
    this.camera.update(dt);
    this.sky.update(skyDt, this.deps.store.world.objects);
    this.views.tickSpin();
    this.lod.update(this.views.views, this.parts.camera, this.deps.stage.clientHeight || 600, dt);
    this.bubbles.update();
  }

  /** the world, then the gizmos on top of it */
  draw(): void {
    this.webgl.clear();
    this.webgl.render(this.parts.scene, this.parts.camera);
    this.webgl.clearDepth();
    this.webgl.render(this.parts.gizmoScene, this.parts.camera);
  }

  resize(): void {
    const { clientWidth: w, clientHeight: h } = this.deps.stage;
    this.webgl.setSize(w, h, false);
    this.parts.camera.aspect = w / Math.max(1, h);
    this.parts.camera.updateProjectionMatrix();
  }

  private elementDeps() {
    return { picker: this.picker, views: this.views, store: this.deps.store, revisionOf: this.deps.revisionOf };
  }

  private listen(): void {
    const { bus, store } = this.deps;
    bus.on("world:changed", () => {
      this.views.syncAll();
      this.highlights.refresh();
      this.sky.scan(store.world.objects);
    });
    bus.on("world:dragging", ({ ids }) => {
      for (const id of ids) {
        const o = store.byId(id);
        if (o) this.views.syncTransform(o);
      }
    });
    bus.on("selection:changed", () => this.highlights.refresh());
    bus.on("mode:changed", () => this.highlights.refresh());
  }
}

function createWebGL(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const webgl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  webgl.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
  webgl.shadowMap.enabled = true;
  webgl.shadowMap.type = THREE.PCFSoftShadowMap;
  webgl.autoClear = false;
  return webgl;
}

/** the sky behind the canvas is a CSS gradient; the sky module sets its two colours */
function setSkyColors(top: string, bottom: string): void {
  document.documentElement.style.setProperty("--sky-top", top);
  document.documentElement.style.setProperty("--sky-bot", bottom);
}
