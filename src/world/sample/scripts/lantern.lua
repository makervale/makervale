-- Click to switch the lantern off and on (only its glass glows).
function onTouch(player)
  state.dark = not state.dark
  glow(state.dark and 0 or 1.4, 2)
  color(state.dark and "#8f8a7c" or "#ffd27a", 2)
end
