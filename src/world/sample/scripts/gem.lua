-- A hidden gem: click it and the treasure chest counts it for you.
local n = tonumber(me.name:match("%d+"))
spin(0, 0, 45)
glow(0.6)

function onTouch(player)
  send("Treasure chest", "found", n, player)
  play(12 + n, "bell")
  glow(2)
  grow(1.4, 0.15)
  grow(1 / 1.4, 0.3)
  glow(0.6)
end
