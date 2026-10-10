/** The Licenses window (Help › Licenses): what Makervale and the parts it is built from are licensed under. */
import { SOURCE_URL } from "@/app/privacy";

const SOURCE = `<p class="note">Source code and questions (issues):
    <a href="${SOURCE_URL}" target="_blank" rel="noopener">${SOURCE_URL}</a></p>`;

export const LICENSES_HTML = `<section class="floater help" id="licenses" aria-label="Licenses" hidden>
  <div class="fhead" data-drag><span class="ft">Licenses</span><button class="x" data-close="licenses" title="Close"><svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6"><path d="M1 1l8 8M9 1 1 9"/></svg></button></div>
  <div class="fbody">
    <dl>
      <dt>Makervale</dt><dd>MIT License, see <a href="LICENSE" target="_blank" rel="noopener">LICENSE</a>.</dd>
      <dt>3D</dt><dd>three.js, three-mesh-bvh, three-bvh-csg (MIT).</dd>
      <dt>Avatars</dt><dd>three-vrm (MIT). Models and thumbnails from the <a href="https://github.com/ToxSam/open-source-avatars" target="_blank" rel="noopener">Open Source Avatars</a> registry (100Avatars by Polygonal Mind and others), CC0.</dd>
      <dt>Animations</dt><dd>From <a href="https://github.com/overte-org/overte" target="_blank" rel="noopener">Overte</a>, Apache License 2.0, © High Fidelity, Vircadia, Overte e.V.; retargeted and trimmed for Makervale.</dd>
      <dt>Networking</dt><dd>Trystero, @noble/curves, @noble/hashes, @noble/secp256k1 (MIT).</dd>
      <dt>Files</dt><dd>fflate (MIT).</dd>
    </dl>
    <p class="note">Full licence texts: <a href="THIRD_PARTY_LICENSES.md" target="_blank" rel="noopener">THIRD_PARTY_LICENSES.md</a>, published with the app.</p>
    ${SOURCE}
  </div>
</section>`;
