-- The football: walk into it to dribble, run into it (Shift+W) to shoot, or click it to kick it away from you.
-- Say "reset ball" in the chat to bring it back to the centre spot. After a goal it comes back by itself.
function onTouch(player)
  kick(player, 7)
  send("Scoreboard", "kicked", player)
end

function onHear(player, text)
  if text:lower():find("reset ball") then
    say("Back to the centre spot!")
    home()
  end
end

function onBump(other)
  if other:find("goal area") then
    wait(1.5)
    home()
  end
end
