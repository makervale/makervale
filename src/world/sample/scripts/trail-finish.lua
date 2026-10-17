-- The top of the sky trail: the clock stops here, and the three best times stay on show.
local started = {}            -- player → when they stepped on the start pad
state.best = state.best or {} -- {player, seconds}, best first

local function show()
  local lines = {"Best times"}
  for i, b in ipairs(state.best) do
    lines[#lines + 1] = `{i}. {b.player}  {string.format("%.1f", b.seconds)} s`
  end
  if #state.best == 0 then lines[#lines + 1] = "Nobody yet: be the first!" end
  label(table.concat(lines, "\n"))
end

function onMessage(from, what, player)
  if what == "start" then started[player] = now() end
end

function onEnter(player)
  local t0 = started[player]
  if not t0 then
    say(`{player}, start on the pad at the bottom to race the clock!`)
    return
  end
  started[player] = nil
  local seconds = now() - t0
  say(`{player} made it in {string.format("%.1f", seconds)} seconds!`)
  table.insert(state.best, {player = player, seconds = seconds})
  table.sort(state.best, function(a, b) return a.seconds < b.seconds end)
  while #state.best > 3 do table.remove(state.best) end
  show()
  send("Hall of Fame", "Sky trail", player, math.floor(seconds * 10) / 10, " s", true)
  for _, note in ipairs({0, 4, 7, 12}) do
    play(note, "marimba")
    wait(0.12)
  end
end

show()
