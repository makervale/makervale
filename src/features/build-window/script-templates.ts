/** Ready-made scripts for the Script tab: each shows one thing a script can do. */
export interface Template {
  id: string;
  name: string;
  src: string;
}

const door = `-- Click to open or close. It swings around its left edge.
-- What is in "state" is kept when another computer takes over the room.
pivot(-0.5, 0, 0)

function onTouch(player)
  state.open = not state.open
  turn(0, 0, state.open and 95 or -95, 0.8)
end
`;

const light = `-- Click to switch the light on and off.
function onTouch(player)
  state.on = not state.on
  if state.on then
    glow(1)
    color("#ffe7a3")
  else
    glow(0)
    color("#d8d4c8")
  end
end
`;

const spinner = `-- Turns slowly; click to stop or start it.
function onStart()
  spin(0, 0, state.stopped and 0 or 30)
end

function onTouch(player)
  state.stopped = not state.stopped
  onStart()
end
`;

const greeter = `-- Says hello when someone comes within 4 m.
setReach(4)

function onNear(player)
  say(\`Welcome, {player}!\`)
end
`;

const colors = `-- Changes colour every second.
local colors = {"#e05a47", "#f2b84b", "#4bb37a", "#4a8fe0"}
local i = 0

every(1, function()
  i = i % #colors + 1
  color(colors[i])
end)
`;

const lift = `-- Click to ride up; it comes back down by itself.
local busy = false

function onTouch(player)
  if busy then return end
  busy = true
  say("Going up!")
  move(0, 0, 3, 2.5)
  wait(4)
  home(2.5)
  busy = false
end
`;

const float = `-- Bobs up and down for ever.
function onStart()
  while true do
    move(0, 0, 0.25, 1.6)
    move(0, 0, -0.25, 1.6)
  end
end
`;

const listener = `-- Answers when someone says "hello" in the chat.
function onHear(player, text)
  if text:lower():find("hello") then
    say(\`Hello, {player}! You said: {text}\`)
  end
end
`;

const counter = `-- Counts clicks per person and shows the top clicker above itself.
state.clicks = state.clicks or {}

function onTouch(player)
  state.clicks[player] = (state.clicks[player] or 0) + 1
  local best, most = player, 0
  for name, n in pairs(state.clicks) do
    if n > most then best, most = name, n end
  end
  label(\`Top clicker: {best} ({most})\`)
  grow(1.05, 0.2)
end
`;

const pad = `-- A pad: glows while someone stands on it.
local on = 0

function onEnter(player)
  on += 1
  glow(1)
  say(\`{player} is on the pad\`)
end

function onLeave(player)
  on -= 1
  if on == 0 then glow(0) end
end
`;

const button = `-- A button: rings every object named "Bell".
-- Give a bell this script:
--   function onMessage(from, what, player)
--     if what == "ring" then play(12) say(player .. " rang me") end
--   end
function onTouch(player)
  send("Bell", "ring", player)
end
`;

export const TEMPLATES: Template[] = [
  { id: "door", name: "Door", src: door },
  { id: "light", name: "Light switch", src: light },
  { id: "spinner", name: "Spinner", src: spinner },
  { id: "greeter", name: "Greeter", src: greeter },
  { id: "colors", name: "Colour cycle", src: colors },
  { id: "lift", name: "Lift", src: lift },
  { id: "float", name: "Float", src: float },
  { id: "listener", name: "Listener", src: listener },
  { id: "counter", name: "Counter with a label", src: counter },
  { id: "pad", name: "Pad", src: pad },
  { id: "button", name: "Button (send)", src: button },
];
