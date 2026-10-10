/** The menu bar's markup: File, Edit, View, Tools, Help. Each item names its command in `data-cmd`. */

/** [label, command, shortcut?]; null is a separator */
type Item = [string, string, string?] | null;

const MENUS: [string, Item[]][] = [
  [
    "File",
    [
      ["New scene", "new"],
      ["Open project…", "open"],
      ["Save project", "save", "Ctrl+S"],
      null,
      ["Import model (OBJ, STL, glTF)…", "tool:import"],
      null,
      ["Export glTF…", "export"],
      ["Export OBJ…", "tool:exportobj"],
      ["Export STL (3D print)…", "tool:exportstl"],
      null,
      ["Load sample scene", "sample"],
    ],
  ],
  [
    "Edit",
    [
      ["Undo", "undo", "Ctrl+Z"],
      ["Redo", "redo", "Ctrl+Y"],
      null,
      ["Duplicate", "tool:duplicate", "Ctrl+D"],
      ["Delete", "del", "Del"],
      null,
      ["Select all", "tool:selall", "Ctrl+A"],
      ["Deselect", "desel", "Esc"],
    ],
  ],
  [
    "View",
    [
      ["Focus on selection", "focussel", "F"],
      ["Reset view", "home", "Esc"],
      null,
      ["Camera controls", "win:camfl"],
      ["Mesh edges on all objects", "wire"],
      null,
      ["Midday", "time:day"],
      ["Sunset", "time:sunset"],
      ["Night", "time:night"],
      ["Day cycle (20 min)", "time:cycle"],
      null,
      ["Sound on / off", "sound"],
    ],
  ],
  [
    "Tools",
    [
      ["Tools", "catalog", "Ctrl+K"],
      ["Quick search", "search", "/"],
      null,
      ["Check mesh", "tool:check"],
      ["Build window", "win:build", "Ctrl+B"],
    ],
  ],
  [
    "Help",
    [
      ["Controls and shortcuts", "win:help"],
      ["Privacy", "win:privacy"],
      ["Licenses", "win:licenses"],
      ["About Makervale", "about"],
    ],
  ],
];

/** hidden on phones (mobile.css), where building and the camera window are off */
const DESKTOP_MENUS = new Set(["File", "Edit", "Tools"]);
const DESKTOP_COMMANDS = new Set(["focussel", "win:camfl", "wire"]);

function itemHtml(item: Item): string {
  if (!item) return '<div class="sep"></div>';
  const [label, cmd, key] = item;
  const desk = DESKTOP_COMMANDS.has(cmd) ? ' class="desktop-only-item"' : "";
  return `<button data-cmd="${cmd}"${desk}>${label}${key ? ` <kbd>${key}</kbd>` : ""}</button>`;
}

function menuHtml([title, items]: [string, Item[]]): string {
  const cls = DESKTOP_MENUS.has(title) ? "m desktop-only-menu" : "m";
  return `<div class="${cls}"><button>${title}</button><div class="menu">${items.map(itemHtml).join("")}</div></div>`;
}

export const MENUBAR_HTML =
  MENUS.map(menuHtml).join("") +
  '<div class="brand"><span class="experimental" title="A prototype with bugs: see Help › Privacy">Experimental software</span><b>Makervale</b><span class="tagline"> · build together</span></div>';
