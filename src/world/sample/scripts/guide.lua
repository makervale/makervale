-- The guide: greets people as they arrive and tells them what there is to do.
-- Say "help" or "tip" in the chat when you're near.
setReach(5)

local tips = {
  "Climb the sky trail in the east: step on the start pad and race the clock to the top!",
  "Click the orb in the west to play Simon: listen to the bells, then play them back.",
  "Five gems glow in hidden places. Click them all and the treasure chest opens for you.",
  "Kick the ball into a goal on the pitch up north. The scoreboard keeps count.",
  "Bounce on the trampoline: it throws you higher than the lanterns.",
  "Every game here is a script. Select a thing, open the Script tab, and read how it works.",
}
local greeted = {}

function onNear(player)
  if greeted[player] then return end
  greeted[player] = true
  say(`Hi {player}! Welcome to the plaza. Say "help" in the chat and I'll tell you what to do here.`)
end

function onHear(player, text)
  local t = text:lower()
  if t:find("help") or t:find("game") then
    say(`{player}: there are four games. The sky trail, Simon, the gem hunt and football. Say "tip" for a tip!`)
  elseif t:find("tip") then
    say(tips[math.random(#tips)])
  end
end

function onTouch(player)
  say(tips[math.random(#tips)])
  turn(0, 0, 360, 1.2)
end
