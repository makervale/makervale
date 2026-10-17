-- The scoreboard: the goals tell it who scored, the ball who kicked it last.
-- Say "new match" in the chat to start again from 0 : 0.
state.score = state.score or {Red = 0, Blue = 0}
state.goals = state.goals or {} -- player → goals scored
local lastKick = nil

local function show()
  label(`RED {state.score.Red} : {state.score.Blue} BLUE` .. (lastKick and `\nLast kick: {lastKick}` or ""))
end

function onMessage(from, what, who)
  if what == "kicked" then
    lastKick = who
    show()
  elseif what == "goal" then
    state.score[who] += 1
    say(`GOAL for {who}!` .. (lastKick and ` Scored by {lastKick}.` or ""))
    if lastKick then
      state.goals[lastKick] = (state.goals[lastKick] or 0) + 1
      send("Hall of Fame", "Football", lastKick, state.goals[lastKick], " goals", false)
    end
    show()
  end
end

function onHear(player, text)
  if text:lower():find("new match") then
    state.score = {Red = 0, Blue = 0}
    say("New match! 0 : 0")
    show()
  end
end

show()
