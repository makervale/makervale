/**
 * The privacy note and terms, in one place: the start screen asks for them to be accepted before anything else,
 * the Multiplayer window repeats the part about going online (once per visit), Help shows the whole text any time.
 * Plain facts about what leaves the browser and to whom; there is no server of ours, so most of it is about what
 * we cannot do. PRIVACY.md in the repository is the same text for the page the app is published on: keep them in
 * step, and change TERMS_VERSION whenever the meaning changes (everyone is asked to accept again).
 */

export const TERMS_VERSION = "2026-10-10.8";

/** where the code lives, and where questions go (its issues) */
export const SOURCE_URL = "https://github.com/makervale/makervale";

/** the whole note as HTML (no user content in here, so no escaping needed) */
export const PRIVACY_HTML = `
<p class="terms-date">Version ${TERMS_VERSION}</p>
<h4>1. What Makervale is, and who it is for</h4>
<p><b>Makervale is an experimental prototype, made as a hobby, and it is for adults: you must be 18 or older to
  use it.</b> It is free and unfinished, <b>it contains bugs</b>, and it may change, break or disappear at any
  time. It runs entirely in your browser and has <b>no server of its own</b>: the author runs nothing that could
  see, store or forward what you do. There are no accounts, no analytics, no cookies, no advertising, and no
  fonts or scripts loaded from other sites.</p>
<p><b>Hosting.</b> The official version is a static page on GitHub Pages. Loading it and its files (the game,
  the avatars, these texts) means requests to GitHub's servers: GitHub, Inc. sets no cookies on this page, but logs your IP address for security and
  handles those requests under the
  <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">GitHub Privacy Statement</a>,
  not this one. A copy hosted anywhere else is under that host's policy instead.</p>
<h4>2. No cookies; what is stored on your device</h4>
<p>Makervale sets <b>no cookies</b> and does no tracking, profiling or advertising. To work, it uses your
  browser's own storage on your device: <b>local storage</b> and <b>IndexedDB</b> (kept until deleted) and
  <b>session storage</b> (cleared when you close the tab). It keeps there only what its features need:</p>
<ul>
  <li>your scenes and the copies of rooms you were in, so they are there next time;</li>
  <li>your name, avatar and look, and avatar files you loaded or downloaded;</li>
  <li>settings and interface state, such as sound, window and panel layout, tools you pinned or used, and
    notices already shown;</li>
  <li>that you accepted these terms, and which version;</li>
  <li>for multiplayer: your own relay settings if you add any, and for rooms you opened, the private key that
    proves you are their owner.</li>
</ul>
<p>None of it is sent to the author or used for anything but the feature it belongs to, and the app reads no
  other data from your device than files you choose to open. Everything is needed for the app to do what you
  ask, so there is no consent banner. Your consent to go online is not stored. Being a prototype, the app may
  lose or damage what it stores: export scenes you care about (File › Export).</p>
<p><b>Deleting it.</b> The app has no button for this on purpose: a bug could leave something behind, so the
  only reliable way is your browser's own <b>clear site data</b> (in most browsers: the icon to the left of the
  address, then site settings or "clear cookies and site data"; or the browser's privacy settings). Note that
  on sites that host many games or apps, this may also clear other games' saves served from the same
  place. A private or incognito window keeps nothing once it is closed.</p>
<h4>3. Multiplayer: how it works and what it reveals</h4>
<p>Multiplayer is <b>peer-to-peer</b>: your browser connects directly to the browsers of the other people in a
  room (WebRTC), with the help of third-party servers that the author does not run. Nothing is contacted until
  you open Multiplayer and agree to go online. That consent lasts for your visit (it is never stored), and
  <b>Withdraw consent</b> in the Multiplayer window takes it back at any time: you leave the room and go offline
  at once. Once you are online:</p>
<ul>
  <li><b>Everyone in your room</b> receives your IP address, your name, your avatar (including any .vrm file you
    load), where your avatar is and what it does, your gestures, your chat messages and the scene you share.
    They receive it on their own computers, where they can keep it, copy it or show it to others. Everyone who
    was in a room keeps a copy of its scene.</li>
  <li><b>Public Nostr relays</b> (open servers run by strangers, chosen from a list in the app) carry the room
    listings and the handshake that introduces browsers to each other. They see your IP address, the room's
    name and code, the number of people and objects in it, and the handshake messages.</li>
  <li><b>STUN servers</b> run by Google and Cloudflare are asked what your public address is; they see your
    IP address. A <b>TURN relay</b>, if you add one yourself, carries your room traffic.</li>
  <li>Traffic between browsers is encrypted on the way; the people in the room are the other end of it.</li>
</ul>
<p>An IP address can reveal your approximate location and your internet provider, and someone who has it can
  try to flood your connection. <b>Only join rooms of people you trust</b>, and only let people you trust into
  yours: the moment you share a room with a stranger, that stranger has your IP address and everything listed
  above, and could harass you, show you offensive content, or build and say things you don't want to see.
  The app never proposes or joins a room on its own; every room is your choice. If you do join a public room,
  use a nickname, share nothing personal, and leave the moment it feels wrong.</p>
<h4>4. Software flaws can be exploited</h4>
<p>Makervale is a prototype and certainly has bugs; so do browsers. Going online means your computer receives data
  from other people (scenes, scripts, avatar files, messages) and acts on it. Someone may craft such data on
  purpose to <b>exploit a flaw</b>. That could freeze or crash the app, fill your browser's storage, damage or
  overwrite your saved scenes, or slow your computer down. In the worst case, combined with a flaw in your
  browser, graphics driver or operating system, it could <b>harm your computer itself</b>: run harmful code on
  it, <b>read or steal your files</b>, passwords or other data, install malicious software, take over your
  accounts, or damage your system. The app checks what it receives and runs others' scripts in a limited
  sandbox, but it has not been security audited, and the author cannot promise that these checks catch
  everything. Keep your browser and system up to date, back up what matters, export scenes you care about, and
  only go online with people you trust.</p>
<h4>5. Multiplayer is outside the author's control</h4>
<p>Because there is no server, the author <b>cannot</b> see which rooms exist or who is in them, cannot read or
  delete anything said or built, cannot ban or report anyone, cannot verify anyone's identity or age, and cannot
  recover anything you shared. Rooms are <b>unmoderated</b>. What other people say, build, wear, script or send
  is their doing alone.</p>
<p>What you can do: the <b>host</b> of a room can remove people; anyone can <b>leave</b> at any time, which ends
  all sharing at once; a room you don't want to keep can be deleted under My rooms; you can play alone, offline,
  with everything else the app offers.</p>
<h4>6. Rules</h4>
<p>You must be 18 or older. Be decent to each other. Don't harass, threaten or deceive anyone, don't try to
  exploit flaws in the app or in other people's computers, don't share anything illegal, hateful or sexual, and
  don't share other people's personal data. Hosts, please remove those who do. The author cannot check anyone's
  age: by accepting these terms you confirm yours, and you are responsible for what you do in rooms.</p>
<h4>7. No liability</h4>
<p>Makervale is an experimental prototype, provided free of charge and as is, without warranty of any kind,
  including that it works, is secure or keeps your data. You use it, and go online with it, at your own risk
  and by your own choice. The author is not responsible for anything other players do, say, build or send, nor
  for any attempt to exploit flaws in the app, your browser or your computer, nor for any damage to your
  computer, theft or loss of files or data, compromised accounts, or any other harm or damage that results from
  any of it, from the third-party servers involved, or from the app itself, to the fullest extent
  the law allows.</p>
<h4>8. Your rights, withdrawing consent, and contact</h4>
<p>The author holds no data about you, so there is nothing to access, correct or delete on the author's side;
  what the app stores is on your device, under your control. You can withdraw your consent at any time, as
  easily as you gave it: <b>Withdraw consent</b> in the Multiplayer window ends going online (you leave the room
  at once). To withdraw your acceptance of these terms, stop using the app and clear its data in your browser
  as described in section 2. What others in a room already received stays on their computers, out of the
  app's and the author's reach. The third parties named above are responsible for what they process (hosting:
  GitHub; relays: each relay's operator; STUN: Google and Cloudflare; avatar downloads: Arweave and the IPFS
  gateways).
  Questions about the app, and contact with the author: open an issue in its source repository,
  <a href="${SOURCE_URL}/issues" target="_blank" rel="noopener">${SOURCE_URL}</a>.</p>
<h4>9. Avatars from the index</h4>
<p>Wearing an avatar from the "More avatars" list downloads it once from Arweave or an IPFS gateway; those
  sites see your IP address. The featured avatars come with the page (should a copy be missing there, they are
  fetched the same way).</p>`;

/** what the Multiplayer window shows every time it is opened outside a room */
export const GO_ONLINE_HTML = `
<p>Going online connects your browser <b>directly to other people's computers</b>. Nothing goes to the author of
  this app, but Makervale is an experimental prototype, so please know what you are agreeing to:</p>
<ul class="mp-risks">
  <li><b>Your IP address</b> is seen by everyone in your room, by the public relays that introduce you and by
    the STUN servers. It reveals your rough location and internet provider, and can be used to flood your
    connection.</li>
  <li><b>Everything you share</b> (name, avatar, chat, the scene) reaches the others' computers, where they can
    keep, copy or show it.</li>
  <li><b>Rooms are unmoderated</b> and outside the author's control: nobody can step in if someone harasses you
    or shows you offensive content.</li>
  <li><b>Someone may try to exploit software flaws</b> (in Makervale, your browser or your system) with crafted
    scenes, scripts or avatar files. That can crash the app or damage your saved scenes, and in the worst case
    <b>harm your computer</b>: run harmful code, <b>steal your files</b> or passwords, install malware or take
    over your accounts. Keep your browser and system up to date and back up what matters.</li>
</ul>
<p><b>Only join rooms of people you trust</b>, and only give your room's code to people you trust. You go online
  at your own risk: the author is not responsible for what other players do or for any damage that results.</p>`;
