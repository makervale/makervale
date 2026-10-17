-- The start of the sky trail: step on it and the clock starts. Then climb the stones to the top!
label("SKY TRAIL\nStep on to start the clock")
glow(0.3)

function onEnter(player)
  send("Finish", "start", player)
  say(`Go, {player}! Up the stones to the top!`)
  play(7, "pluck")
  glow(1)
  wait(0.5)
  glow(0.3)
end
