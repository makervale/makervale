-- A bell for Simon: click it to ring it. The orb rings it too, when it plays its tune.
local n = tonumber(me.name:match("%d+"))
local notes = {0, 2, 4, 7, 9, 12}

local function ring()
  play(notes[n], "bell")
  glow(1.3)
  wait(0.35)
  glow(0.15)
end

function onTouch(player)
  send("Simon", "pressed", n, player)
  ring()
end

function onMessage(from, what)
  if what == "ring" then ring() end
end

glow(0.15)
