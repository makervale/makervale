/** Ready-made scripts for the Script tab (and the start scene). */
export interface Template {
  id: string;
  name: string;
  src: string;
}

const door = `// Click to open or close. It swings around its left edge.
var open = false
on start { pivot -0.5, 0, 0 }
on touch {
  open = not open
  if open { turn 0, 0, 95 in 0.8 } else { turn 0, 0, -95 in 0.8 }
}
`;

const light = `// Click to switch the light on and off.
var lit = false
on touch {
  lit = not lit
  if lit { glow 1; color "#ffe7a3" } else { glow 0; color "#d8d4c8" }
}
`;

const spinner = `// Turns slowly; click to stop or start it.
var going = true
on start { spin 0, 0, 30 }
on touch {
  going = not going
  if going { spin 0, 0, 30 } else { spin 0, 0, 0 }
}
`;

const greeter = `// Says hello when someone comes close.
on near 4 { say "Welcome, " + who + "!" }
`;

const colors = `// Changes colour every second.
var i = 0
on timer 1 {
  i = (i + 1) % 4
  if i == 0 { color "#e05a47" } else if i == 1 { color "#f2b84b" } else if i == 2 { color "#4bb37a" } else { color "#4a8fe0" }
}
`;

const lift = `// Click to ride up; it comes back down by itself.
var busy = false
on touch {
  if busy { stop }
  busy = true
  say "Going up!"
  move 0, 0, 3 in 2.5
  wait 4
  home in 2.5
  busy = false
}
`;

const float = `// Bobs up and down forever.
on start {
  while true {
    move 0, 0, 0.25 in 1.6
    move 0, 0, -0.25 in 1.6
  }
}
`;

const echo = `// Answers when someone says "hello" in chat.
on hear "hello" { say "Hello, " + who + "! You said: " + heard }
`;

const counter = `// Counts clicks and grows a little each time.
var clicks = 0
on touch {
  clicks += 1
  say who + " clicked me " + clicks + " times"
  grow 1.05 in 0.2
  if clicks % 10 == 0 { home in 1 }
}
`;

export const TEMPLATES: Template[] = [
  { id: "door", name: "Door", src: door },
  { id: "light", name: "Light switch", src: light },
  { id: "spinner", name: "Spinner", src: spinner },
  { id: "greeter", name: "Greeter", src: greeter },
  { id: "colors", name: "Colour cycle", src: colors },
  { id: "lift", name: "Lift", src: lift },
  { id: "float", name: "Float", src: float },
  { id: "echo", name: "Listener", src: echo },
  { id: "counter", name: "Counter", src: counter },
];
