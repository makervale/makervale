/** The "Controls and shortcuts" window (Help menu and the bottom bar's Help button). */

export const HELP_HTML = `<section class="floater help" id="help" aria-label="Controls" hidden>
  <div class="fhead" data-drag><span class="ft">Controls and shortcuts</span><button class="x" data-close="help" title="Close"><svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6"><path d="M1 1l8 8M9 1 1 9"/></svg></button></div>
  <div class="fbody">
    <h3>Camera</h3>
    <dl>
      <dt><kbd>Alt</kbd> + click</dt><dd>Set the point the camera looks at. The camera turns smoothly, it does not jump.</dd>
      <dt><kbd>Alt</kbd> + drag</dt><dd>Sideways: orbit around the point. Up/down: zoom.</dd>
      <dt><kbd>Ctrl</kbd><kbd>Alt</kbd> · <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>Shift</kbd></dt><dd>Orbit · pan the view.</dd>
      <dt>Wheel · right · middle</dt><dd>Zoom · orbit · pan. A right-click without moving opens the pie menu.</dd>
      <dt><kbd>F</kbd> · <kbd>Esc</kbd></dt><dd>Focus on selection · deselect; press again to reset the view.</dd>
    </dl>
    <h3>Avatar</h3>
    <dl>
      <dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · arrows</dt><dd>Walk and turn. <kbd>Shift</kbd>+<kbd>A</kbd>/<kbd>D</kbd> steps sideways, <kbd>Shift</kbd>+<kbd>W</kbd> runs.</dd>
      <dt><kbd>Space</kbd> · <kbd>E</kbd> · <kbd>Page Up</kbd></dt><dd>Jump, or go up while flying. Hold it in the air or tap it twice to take off. (<kbd>E</kbd> extrudes instead while you edit a mesh.)</dd>
      <dt><kbd>C</kbd> · <kbd>Page Down</kbd></dt><dd>Go down while flying; reaching the ground lands.</dd>
      <dt><kbd>F</kbd> · <kbd>Home</kbd></dt><dd>Fly / stop flying (<kbd>F</kbd> focuses the camera instead when something is selected). The bottom-bar button does the same.</dd>
      <dt>Sitting</dt><dd>Right-click an object: <b>Sit here</b>. Walking keys won't stand you up by accident: press <kbd>W</kbd> twice, <kbd>Space</kbd>, or <b>Stand</b>. <kbd>A</kbd>/<kbd>D</kbd> look around.</dd>
      <dt>Right-click ground</dt><dd>With nothing selected: <b>Teleport here</b>.</dd>
      <dt>Camera</dt><dd>Follows behind the avatar until you move it yourself. <kbd>Esc</kbd> with nothing selected puts it back.</dd>
      <dt>Avatar button</dt><dd>Your name and body: the built-in figure (choose its look), one of hundreds of free VRM avatars, or your own .vrm file.</dd>
      <dt>Gestures button</dt><dd>Raise a hand, clap, nod, shake your head, point. Everyone in the room sees it.</dd>
    </dl>
    <h3>Scripts</h3>
    <dl>
      <dt>Click (Build window closed)</dt><dd>Objects with a script that reacts to touch (the cursor turns into a hand) do their thing: doors open, lights switch, the lift goes up. With the Build window open, a click selects them for editing instead; right-click › <b>Touch</b> still works.</dd>
      <dt>Build › Script</dt><dd>Give the selected object a script, from a template or your own. Scripts can only change their own object, so they are safe to run.</dd>
    </dl>
    <h3>Multiplayer</h3>
    <dl>
      <dt>Multiplayer button</dt><dd>Open a room with your scene, join one from the public list, or join with a code. Everyone walks and builds together.</dd>
      <dt><kbd>Enter</kbd></dt><dd>Chat with the people in the room.</dd>
      <dt>My rooms</dt><dd>Every room you were in is saved in this browser. Reopen it any time, even alone; when you meet someone who stayed in the room, their copy is the current one.</dd>
    </dl>
    <h3>Editing</h3>
    <dl>
      <dt><kbd>1</kbd>…<kbd>5</kbd></dt><dd>Object, Mesh (grabs whatever is closest to the cursor), Vertices, Edges, Faces. <kbd>Tab</kbd> switches Object ↔ Mesh.</dd>
      <dt>Double-click</dt><dd>On an object: edit the mesh. On an edge: loop (with <kbd>Shift</kbd>: ring). On a face: the whole part.</dd>
      <dt>Arrow</dt><dd>Free move. Slide the cursor off the axis onto the ruler and the move snaps to the ticks.</dd>
      <dt><kbd>Ctrl</kbd> · <kbd>Ctrl</kbd><kbd>Shift</kbd></dt><dd>Hold for Rotate · Stretch.</dd>
      <dt><kbd>Shift</kbd> + drag</dt><dd>Object: leave a copy. Vertex: pull out a spike. Edge: insert a new point; on an open edge, add a face.</dd>
      <dt>Tool in the view</dt><dd>Once started (key, pie menu, Tools panel), moving the mouse sets the value, the wheel sets the count, typing digits sets it exactly, <kbd>Ctrl</kbd> snaps. Click or <kbd>Enter</kbd> confirms, <kbd>Esc</kbd> cancels.</dd>
      <dt><kbd>/</kbd> · <kbd>Ctrl</kbd><kbd>K</kbd></dt><dd>Quick search for a tool · Tools panel.</dd>
      <dt><kbd>E</kbd> <kbd>I</kbd> <kbd>B</kbd> <kbd>K</kbd> <kbd>Ctrl</kbd><kbd>R</kbd></dt><dd>Extrude, Inset, Bevel, Knife, Loop cut.</dd>
      <dt><kbd>M</kbd> <kbd>J</kbd> <kbd>L</kbd> <kbd>Shift</kbd><kbd>B</kbd></dt><dd>Merge at center, Connect vertices, Select linked, Bridge.</dd>
      <dt><kbd>+</kbd> <kbd>−</kbd> · <kbd>Ctrl</kbd><kbd>A</kbd> <kbd>Ctrl</kbd><kbd>I</kbd></dt><dd>Grow, shrink · select all, invert the selection.</dd>
      <dt><kbd>H</kbd> <kbd>Shift</kbd><kbd>H</kbd> · <kbd>G</kbd></dt><dd>Hide, unhide · snap on/off.</dd>
      <dt><kbd>Ctrl</kbd><kbd>D</kbd> <kbd>Ctrl</kbd><kbd>J</kbd> <kbd>Ctrl</kbd><kbd>G</kbd> <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>G</kbd></dt><dd>Duplicate, Join, Group, Ungroup.</dd>
      <dt><kbd>Ctrl</kbd><kbd>Z</kbd> <kbd>Ctrl</kbd><kbd>Y</kbd> <kbd>Ctrl</kbd><kbd>S</kbd> <kbd>Ctrl</kbd><kbd>B</kbd></dt><dd>Undo, Redo (while building), Save project, Build window.</dd>
    </dl>
  </div>
</section>`;
