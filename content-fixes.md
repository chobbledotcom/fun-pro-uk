---
no_index: true
---

# Content Fixes

## Done

- **gladiator-duel.md** — `meta_description` described a bungee run ("Strap on the bungee cords and race to the end!") instead of a gladiator duel. Rewritten to describe the actual product.
- **christmas-photo-booths.md** — `meta_title` had brand name reversed: "Pro Fun UK" instead of "Fun Pro UK". Fixed.
- **air-hockey-table-hire.md** — `meta_title` and `meta_description` were completely generic ("Check out all our games that available to hire through out The west Midlands and the UK"). Rewritten to describe air hockey specifically.
- **roll-and-bowl-reindeer-racing-game-hire.md** — `meta_title` was just "Reindeer Racing UK" and `meta_description` was just "Contact fun Pro UK today to book your next Christmas event." — neither mentioned the actual product. Rewritten.
- **whack-an-elf.md** — `meta_title` was just "Christmas Game Hire UK" and `meta_description` was "For The Best Christmas Game Hire, Contact Us Today." — neither mentioned Whack an Elf. Rewritten.
- **pix-n-mix-hire.md** — `meta_title` said "Pick A Mix" while `title` said "Pick N Mix". Standardised meta_title to "Pick N Mix" to match the title.
- **danger-zone-strike-a-light-game-hire.md** — `title` was a raw URL slug with hyphens: "Danger-zone-strike-a-light-game-hire". Fixed to "Danger Zone Strike A Light Game Hire". Tab title also fixed.
- **electronic-basket-ball-hire.md** — `title` and tab title were ALL CAPS: "ELECTRONIC BASKET BALL HIRE". Fixed to "Electronic Basketball Hire".
- **paella.md** — `title` was ALL CAPS ("PAELLA"), `meta_title` was "PAELLA - Exhibition and Game Hire in Nationwide | Fun Pro UK", and `meta_description` was generic. All rewritten.
- **football-tables.md** — Tab title said "Why FOOTBALL TABLES?" but the product `title` is "Table Football". Fixed tab title to "Why Table Football?" to match.
- **bungee-run.md** — `specs` Players said "1 player" but the game is a 2-player race. Fixed to "2 players".
- **ballnado-grabber.md** — Video title said "Bespoke Photo Booth" instead of "Ballnado Grabber". Fixed.
- **cash-grabber-machine-hire.md** — Video title said "Bespoke Photo Booth" instead of "Cash Grabber Machine". Fixed.
- **bbq.md** — `specs` Suitability said "Indoor only / Level surface" but the content describes outdoor summer BBQ cooking. Fixed to "Outdoor / Level surface". Also rewrote generic `meta_title` and `meta_description`.

## Questions — Power spec contradictions

The following products have contradictions between their `specs` Power field, `filter_attributes` Power Required field, and/or FAQ answers. These need someone with product knowledge to confirm which is correct.

### Specs say "No power required" but filter_attributes say "Mains power required"

- **candy-cane-megawire.md** — Specs: "No power required". Filter: "Mains power required". FAQ says mains power IS needed for the buzzer. Likely the specs field is wrong.
- **crazy-golf.md** — Specs: "No power required". Filter: "Mains power required".
- **giant-buzz-wire.md** — Specs: "No power required". Filter: "Mains power required".
- **leader-board.md** — Specs: "No power required". Filter: "Mains power required". FAQ says mains power IS needed for the digital display. Likely the specs field is wrong.
- **shuffleboard-hire.md** — Specs: "No power required". Filter: "Mains power required".
- **plinko-game-hire.md** — Specs: "No power required". Filter: "Mains power required". FAQ says no power needed.

### Specs say power required but filter/tabs/FAQ say no power

- **human-table-football.md** — Specs: "1 x Power Socket (800W)". Filter: "No power required". It's an inflatable so probably does need a blower (specs correct).
- **roll-and-bowl-donkey-derby.md** — Specs: "2 x Power Socket (180-230W)". Tab body and FAQ say "no power required".
- **roll-and-bowl-game-hire.md** — Specs: "2 x Power Socket (180-230W)". Tab body and FAQ say "no power required".
- **roll-and-bowl-reindeer-racing-game-hire.md** — Specs: "1 x Power Socket (180-230W)". Tab body and FAQ say "no power required".

### Other power oddity

- **pluck-a-duck-racing.md** — Specs: "1 x Power Socket (5-7W)". FAQ says "No, Pluck a Duck Racing requires no power." The game uses electromagnets per the How It Works tab, so it almost certainly does need power (FAQ is likely wrong).
