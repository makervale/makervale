-- The chest's lid: it swings open about its back edge when the chest says so, then shuts.
pivot(0, 0.5, -0.5)
local open = false

function onMessage(from, what)
  if what ~= "open" or open then return end
  open = true
  turn(-110, 0, 0, 0.8)
  wait(5)
  turn(110, 0, 0, 0.8)
  open = false
end
