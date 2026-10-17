-- The hall of fame: the games send it their records, and it shows the best of each.
-- A game sends: send("Hall of Fame", game, player, value, unit, lowerIsBetter)
state.best = state.best or {}
local games = {"Sky trail", "Simon", "Gem hunt", "Football"}

local function show()
  local lines = {"HALL OF FAME"}
  for _, game in ipairs(games) do
    local b = state.best[game]
    lines[#lines + 1] = b and `{game}: {b.player}, {b.value}{b.unit}` or `{game}: nobody yet`
  end
  label(table.concat(lines, "\n"))
end

function onMessage(from, game, player, value, unit, lowerIsBetter)
  local b = state.best[game]
  local better = b == nil or (lowerIsBetter and value < b.value) or (not lowerIsBetter and value > b.value)
  if not better then return end
  state.best[game] = {player = player, value = value, unit = unit or ""}
  say(`New record in {game}: {player}, {value}{unit or ""}!`)
  for _, note in ipairs({0, 4, 7, 12}) do
    play(note, "bell")
    wait(0.15)
  end
  show()
end

show()
