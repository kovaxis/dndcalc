export interface Bundle {
    name: string
    source: string
}

export const EXAMPLE: Bundle = {
    name: "Example",
    source: `
Magic Missile: (3 + lvl1)(1d4+1)
Scorching Ray: lvl2[3] atk 2d6
Fireball: area dexh lvl3[8]d6
`,
}

export const BUNDLES: Bundle[] = [
    EXAMPLE,
    {
        name: "Level 1 Wizard",
        source: `
# Level 1
Burning Hands: area dexh lvl1[3]d6
Catapult: dex lvl1[3]d8
Chromatic Orb: atk lvl1[3]d8
Earth Tremor: area dex lvl1[1]d6
Frost Fingers: area conh lvl1[2]d8
Ice Knife: atk 1d10 + area dex lvl1[2]d6
Magic Missile: (3 + lvl1d)(1d4+1)
Ray of Sickness: atk lvl1[2]d8
Tasha's Caustic Brew: area time dex (2+2*lvl1d)d4
Thunderwave: area conh lvl1[2]d8
Witch Bolt: time atk lvl1[1]d12


# Parameters

group[flow=row]
parameter[type=number][min=1][max=9] level ? Level = 1
parameter[type=number][min=1] area ? Targets = 1
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

define atk = fn roll { (roll != 1) max[roll + spellmod >= ac][2 * (roll == 20)] } [d20]

define dex = d20 + dexmod < 8 + spellmod
define dexh = max[dex][0.5]
define con = d20 + conmod < 8 + spellmod
define conh = max[con][0.5]

define lvl1d = max[0][level - 1]
define lvl1 = fn x { x + lvl1d }

define max = fn x y { 0-min[0-x][0-y] }
`
    },
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
Melf's Acid Arrow: atkh lvl2[4]d4 + atk lvl2[2]d4  # hack
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
`
    }
]
