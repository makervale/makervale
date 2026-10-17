-- Simon: click the orb, listen to the bells, then play the tune back by clicking them.
-- Every round the tune grows by one note. Miss one and the game is over.
local tune = {}       -- bell numbers, in order
local step = 1        -- which note comes next
local player = nil    -- who started this game
local playing = false -- the orb is playing the tune: wait
local lastPress = 0

local function idle()
  tune, player, playing = {}, nil, false
  glow(0.3)
  label("SIMON\nClick me to play")
end

local function playTune()
  playing = true
  glow(1)
  wait(0.8)
  for _, n in ipairs(tune) do
    send("Bell " .. n, "ring")
    wait(0.6)
  end
  playing, step, lastPress = false, 1, now()
  glow(0.3)
end

local function nextRound()
  tune[#tune + 1] = math.random(6)
  label(`SIMON\n{player}: level {#tune}`)
  playTune()
end

function onTouch(who)
  if player then
    say(`{player} is playing. Help them, or wait for your turn!`)
    return
  end
  player = who
  say(`{who}, listen to the bells, then play them back!`)
  nextRound()
end

function onMessage(from, what, n)
  if what ~= "pressed" or playing or not player then return end
  lastPress = now()
  if n == tune[step] then
    step += 1
    if step > #tune then
      say(`Level {#tune} done!`)
      nextRound()
    end
    return
  end
  say(`Oops! {player} got to level {#tune - 1}.`)
  send("Hall of Fame", "Simon", player, #tune - 1, " levels", false)
  color("#d24b4b")
  wait(1.2)
  color("#7fc8ff")
  idle()
end

-- a game nobody plays any more ends by itself
every(5, function()
  if player and not playing and now() - lastPress > 30 then
    say("Nobody's playing: Simon waits for the next player.")
    idle()
  end
end)

idle()
