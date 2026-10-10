/** File import and export. Editor convention: Z-up, metres. OBJ and glTF are Y-up; STL is Z-up in mm. */
export { toSTL, parseSTL } from "./io/stl";
export type { ObjItem } from "./io/obj-export";
export { toOBJ, MTL_FILE } from "./io/obj-export";
export type { ObjObject } from "./io/obj-import";
export { parseOBJ } from "./io/obj-import";
export type { GlbObject } from "./io/glb";
export { parseGLB, geometryToMesh } from "./io/glb";
export { normaliseForEditor } from "./io/fit";
