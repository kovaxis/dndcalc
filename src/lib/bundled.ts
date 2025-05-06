export interface Bundle {
    name: string
    source: string
}

export const EXAMPLE: Bundle = {
    name: "Example",
    source: `
# === A small selection of spells and sliders to visualize how things work ===

# Repeat 3 times: 1d4+1 damage
# For every level above 1, add a repetition
Magic Missile: (3 + lvl1)(1d4+1)

# Deal 4d4 damage
# When cast at higher levels, deal (4 + 2*[number of levels above level 2])d4 damage
Cloud of Daggers: (4+2*lvl2)d4

# Do a dexterity saving throw
# If it succeeds, roll 3d8 damage
# (Actually, roll 3 + number of levels above 1. Eg. 3d8 for level 1, 4d8 for level 2, etc...)
Catapult: dex lvl1[3]d8

# Do an attack roll
# If it succeeds, do (3 + levels above 1)d8 damage
Chromatic Orb: atk lvl1[3]d8

# Area spell: multiply damage by the number of targets
# Do a dexterity saving throw
# If it succeeds, deal 8d6 damage
# If it fails, deal half damage (dexh means DEX Half)
Fireball: area dexh lvl3[8]d6

# Do 3 attack rolls
# For each attack roll, if it succeeds, deal 2d6 damage
# Note that the order is important!
# 'atk 3 2d6' would mean "do 1 attack roll. if it succeeds, deal 6d6 damage"
Scorching Ray: lvl2[3] atk 2d6

# More complex spell:
# Do an attack roll
# If it succeeds (hit = 1), then deal 4d4 damage and 2d4 damage later
# If it fails (hit = 0), then deal half of the 4d4 damage, and ignore de 2d4 damage
# (Note that if hit = 2 (a critical hit) everything still works out)
Melf's Acid Arrow: (fn hit { max[hit][0.5] lvl2[4]d4 + hit lvl2[2]d4})[atk]




# Parameters: number boxes and sliders

group[flow=row]
parameter[type=number][min=1][max=9] level    ? Level = 1
parameter[type=number][min=1]        area     ? Area targets = 1

group Your attributes
parameter[min=-10][max=10]           spellmod ? Spell mod = 5

group Enemy attributes
parameter[min=10][max=30]            ac       ? AC = 15
parameter[min=-10][max=10]           dexmod   ? DEX save = 3




# Utilities
# The expressions 'atk', 'dex' and 'dexh' are actually defined here!

define atk = fn roll { (roll != 1) * max[roll + spellmod >= ac][2 * (roll == 20)] } [d20]
define dex = d20 + dexmod < 8 + spellmod
define dexh = max[dex][0.5]
`,
}

export const BUNDLES: Bundle[] = [
    EXAMPLE,
    {
        name: "D&D 5e Wizard",
        source: `
# Level 1
Burning Hands: area dexh lvl1[3]d6
Catapult: dex lvl1[3]d8
Chromatic Orb: atk lvl1[3]d8
Earth Tremor: area dex lvl1[1]d6
Frost Fingers: area conh lvl1[2]d8
Ice Knife: atk 1d10 + area dex lvl1[2]d6
Jim's Magic Missile: max[0][ lvl1[3] fn roll { (roll == 20) 3d4 + max[roll + spellmod >= ac][roll == 20] 2d4 - (roll == 1) 10000 }[d20] ]
Magic Missile: (3 + lvl1)(1d4+1)
Ray of Sickness: atk lvl1[2]d8
Tasha's Caustic Brew: area time dex (2+2*lvl1)d4
Thunderwave: area conh lvl1[2]d8
Witch Bolt: time atk lvl1[1]d12

# Level 2
Aganazzar's Scorcher: area dexh lvl2[3]d8
Cloud of Daggers: time (4+2*lvl2)d4
Dragon's Breath: area time dexh lvl2[3]d6
Dust Devil: area time strh lvl2[1]d8
Flaming Sphere: area time dexh lvl2[2]d6
Maximilian's Earthen Grasp: time strh 2d6 + 0lvl2
Melf's Acid Arrow: fn hit { max[hit][0.5] lvl2[4]d4 + hit lvl2[2]d4} [atk]
Mind Spike: wish lvl2[3]d8
Phantasmal Force: time int 1d6 + 0lvl2
Rime's Binding Ice: area conh lvl2[3]d8
Scorching Ray: lvl2[3] atk 2d6
Shadow Blade: time (2 + lvl2/2)d8
Shatter: area conh lvl2[3]d8
Snilloc's Snowball Swarm: area dexh lvl2[3]d6
Tasha's Mind Whip: min[area][1+lvl2] inth 3d6
Wither and Bloom: area conh lvl2[2]d6

# Level 3
Ashardalon's Stride: area lvl3[1]d6
Erupting Earth: area dexh lvl3[3]d12
Fireball: area dexh lvl3[8]d6
Flame Arrows: min[time][12 + 2lvl3] 1d6
Glyph of Warding: area dexh lvl3[5]d8
Lightning Bolt: area dexh lvl3[8]d6
Melf's Minute Meteors: min[time][3+lvl3] 2 area dexh 2d6
Spirit Shroud: time (1+lvl3/2)d8
Thunder Step: area conh lvl3[3]d10
Tidal Wave: area dexh 4d8 + 0lvl3
Vampiric Touch: atk time lvl3[3]d6


# Parameters

group[flow=row]
parameter[type=number][min=1][max=9] level ? Slot level = 1
parameter[type=number][min=1] area ? Area targets = 1
parameter[type=number][min=1] time ? Turns = 1

group Your attributes
parameter[min=-10][max=10] spellmod ? Spell mod = 5

group Enemy attributes
parameter[min=10][max=30] ac ? AC = 15
parameter[min=-10][max=10] strmod ? STR save = 3
parameter[min=-10][max=10] dexmod ? DEX save = 3
parameter[min=-10][max=10] conmod ? CON save = 3
parameter[min=-10][max=10] intmod ? INT save = 3
parameter[min=-10][max=10] wismod ? WIS save = 3
parameter[min=-10][max=10] chamod ? CHA save = 3

# Utilities

define atk = fn roll { (roll != 1) * max[roll + spellmod >= ac][2 * (roll == 20)] } [d20]

define str = d20 + strmod < 8 + spellmod
define strh = max[str][0.5]
define dex = d20 + dexmod < 8 + spellmod
define dexh = max[dex][0.5]
define con = d20 + conmod < 8 + spellmod
define conh = max[con][0.5]
define int = d20 + intmod < 8 + spellmod
define inth = max[int][0.5]
define wis = d20 + wismod < 8 + spellmod
define wish = max[wis][0.5]
define cha = d20 + chamod < 8 + spellmod
define chah = max[cha][0.5]
`
    },
]
