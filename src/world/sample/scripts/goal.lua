-- The ground inside a goal: the ball landing here, wholly over the line, is a goal.
-- The north goal is red's, so a ball in it scores for blue, and the other way round.
local team = me.name:find("North") and "Blue" or "Red"
local busy = false

function onBump(other)
  if other ~= "Ball" or busy then return end
  busy = true
  send("Scoreboard", "goal", team)
  wait(2)
  busy = false
end
