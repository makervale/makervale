/** Export the visible scene as glTF binary (zipped), with materials and groups. Open it in Blender, Unity, Godot. */
import * as THREE from "three";
import { zipSync } from "fflate";
import type { Store } from "@/app/store";
import { buildGeometry, infoOf } from "@/render/geometry";
import { MaterialCache } from "@/render/materials";
import type { Obj } from "@/world/model";
import { materialOf } from "@/world/model";
import { toast } from "@/ui/toast";
import { offerFile } from "./download";

const materials = new MaterialCache();

function meshOf(o: Obj, smoothAngle: number): THREE.Mesh {
  const g = buildGeometry(o.mesh, smoothAngle, o.size);
  const info = infoOf(g);
  // the builder's bookkeeping would end up in the file as "extras"
  g.userData = {};
  const mats = Array.from({ length: Math.max(info.slots, 1) }, (_, i) => {
    const m = materials.get(materialOf(o, i), info.open).clone();
    m.name = materialOf(o, i).name;
    return m;
  });
  const mesh = new THREE.Mesh(g, mats.length === 1 ? mats[0] : mats);
  mesh.name = o.name;
  mesh.position.fromArray(o.pos);
  mesh.quaternion.fromArray(o.quat);
  mesh.scale.fromArray(o.size);
  return mesh;
}

function sceneOf(objs: Obj[], smoothAngle: number): THREE.Group {
  const root = new THREE.Group();
  root.name = "Piaskownica";
  root.rotation.x = -Math.PI / 2; // glTF is Y-up
  const groups = new Map<string, THREE.Group>();
  for (const o of objs) {
    const mesh = meshOf(o, smoothAngle);
    if (!o.group) {
      root.add(mesh);
      continue;
    }
    let g = groups.get(o.group);
    if (!g) {
      g = new THREE.Group();
      g.name = "Group";
      groups.set(o.group, g);
      root.add(g);
    }
    g.add(mesh);
  }
  return root;
}

export async function exportGltf(store: Store): Promise<void> {
  const objs = store.visibleObjects();
  if (!objs.length) {
    toast("The scene is empty");
    return;
  }
  toast("Preparing glTF…");
  try {
    const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
    const root = sceneOf(objs, store.settings.smoothAngleDegrees);
    const glb = await new Promise<ArrayBuffer>((resolve, reject) =>
      new GLTFExporter().parse(root, (r) => resolve(r as ArrayBuffer), reject, { binary: true }),
    );
    await offerFile("makervale-gltf.zip", new Blob([zipSync({ "makervale.glb": new Uint8Array(glb) })]));
  } catch (e) {
    console.error(e);
    toast("Export failed");
  }
}
