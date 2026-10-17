-- The treasure chest counts the gems each person finds. Find all five and it opens for you!
local GEMS = 5
state.found = state.found or {} -- player → {[gem number] = true}
local first = {}                -- player → when they found their first gem

local function count(gems)
  local n = 0
  for _ in pairs(gems) do n += 1 end
  return n
end

local function show()
  local rows = {}
  for player, gems in pairs(state.found) do rows[#rows + 1] = {player = player, n = count(gems)} end
  table.sort(rows, function(a, b) return a.n > b.n end)
  local lines = {"GEM HUNT\nFind the 5 glowing gems!"}
  for i = 1, math.min(3, #rows) do lines[#lines + 1] = `{rows[i].player}: {rows[i].n} of {GEMS}` end
  label(table.concat(lines, "\n"))
end

function onMessage(from, what, gem, player)
  if what ~= "found" then return end
  state.found[player] = state.found[player] or {}
  if state.found[player][gem] then return end
  first[player] = first[player] or now()
  state.found[player][gem] = true
  local n = count(state.found[player])
  show()
  if n < GEMS then
    say(`{player} has {n} of {GEMS} gems.`)
    return
  end
  say(`{player} found all {GEMS} gems! The chest opens!`)
  send("Chest lid", "open")
  send("Hall of Fame", "Gem hunt", player, math.floor(now() - first[player]), " s", true)
  for _, note in ipairs({0, 4, 7, 12, 7, 12}) do
    play(note, "bell")
    wait(0.15)
  end
end

function onTouch(player)
  local n = state.found[player] and count(state.found[player]) or 0
  say(`{player}, you have {n} of {GEMS} gems. They glow, and they hide all over the plaza.`)
end

show()
