# deeplink as-built specs

## DEEPLINK-1 — Shared ?path= links open the named screen

A URL with a valid ?path= skipped nothing: the landing picker always showed, and once past it the lab rendered blank because labs only mounted via click handlers. Now a valid ?path= skips the landing picker, labs latch mounted whenever they become active, and ?path= is written only after the user picks (a bare visit stays on the landing).
