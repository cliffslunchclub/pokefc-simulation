# PokéFC enclosed-pitch rules (canonical)

**Status: Active.** Supersedes the experimental set-piece v1 design.

## Match rules
- PokéFC plays soccer inside a rink-like perimeter, with six wall segments and open goal mouths.
- The ball stays in play off the boundary; no throw-ins, corner kicks, out-of-play whistles, fouls, free kicks, slide tackles or in-match penalty kicks.
- Players can dribble, pass, shoot, intercept and contest possession with standing challenges. Goalkeepers can save.
- Shots can cross the goal line between the posts; that is an official goal when and only when PSE records it.
- Scoring restarts at midfield. The Watch renderer remains visual-only, with no independent event or score authority.
- Tied knockout matches retain extra time and the **separate** PSE penalty shootout tiebreaker. Shootout kicks do not count as match goals.

## Engine contract
- `quick-sim.js` remains authoritative for score, goal and goalkeeper-save events, stats and saves across Quick Play, Challenges and Franchise.
- New match event ledgers contain recorded goals and saves only. Standing tackle counts remain in the player/team statistics; they do not generate whistles.
- The retired `setPieces: 'v1'` option is ignored by new PSE simulations and cannot re-enable the experimental incidents.
- Historical v1 result data is not rewritten or discarded. Bridge/report parsing can still recognize archived fields, but there is no new set-piece generation or presentation.
- Soccer-JS Watch movement is illustrative and must keep the ordinary ball in bounds except when a recorded goal crosses into the net.
- **Physical board banks (Watch only):** low passes can reflect off the two long sideboards and the two endboards with normal-direction reversal and modest energy loss. Endboard goal-mouth openings are never reflective; official PSE goal animations alone cross the line between the posts.
- **Loose-ball recoveries:** ordinary dribbles and crosses can rebound off boards and be collected by a teammate or opponent without whistles. Bank passes and pickups occur independently of PSE goal times and cannot change the recorded scorer, result, tackles, or saves. No hidden out-of-bounds resets.
- Wall collisions are deterministic and time-seekable, retain contact and goal replay continuity, and are verified in the shared renderer used by Quick Play, Challenges and Franchise.
- **Attack-third support (Watch presentation only):** midfielders move forward behind the attacking line, wide defenders make staggered overlaps, and central defenders retain cover. A goal credited by PSE to a defender or midfielder must show that specific scorer making a supporting run and finishing; never reassign the PSE goal to a different Pokémon.
- All changes must preserve deterministic seeds and Watch → Sim to End behavior, including exactly-once match recording.

## Regression coverage
- 500 deterministic seeded matches and disabled-v1 equivalence, alongside 120 PSE-to-Watch integration matches.
- Desktop and mobile browser checks for six board segments, ball confinement, goals/replays, and no whistle highlights.
- Existing Challenges, Franchise, knockout and SiteGround deployment tests.
- Four-board reflection geometry, protected goal mouths, continuous bank trajectories, loose-ball ownership/pickup, and native desktop/mobile wall-impact screenshots.

The historical prototype document `PSE-SET-PIECES-V1.md` is archival only and **must not** be used to implement current rules.
