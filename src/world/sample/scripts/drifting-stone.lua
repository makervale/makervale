-- A stepping stone that rises and sinks: time your jump.
function onStart()
  while true do
    move(0, 0, 0.7, 1.6)
    wait(0.8)
    home(1.6)
    wait(0.8)
  end
end
