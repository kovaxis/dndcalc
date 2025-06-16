### Quick start

1. Select your favorite set of spells from the [presets](#presets) above.
2. Check the average damage output for each spell in the [damage analysis box](#analyze).
3. See how the damage changes when you play around with parameters like your Spell Modifier, your enemies' AC, Saving Throw Modifiers, the level you cast your spells at, etc...

### Features

- Easily compare average damage of many spells at once.
- Visualize how different parameters like your spell modifier or your enemies' stats affect the damage of your spell.
- Includes spells for D&D 5e (currently up to level 3 spells).
- Compare damage consistency at a glance with mini damage graphs.
- Pin spells by clicking on their name, to focus on a subset of all available spells.
- View a detailed damage breakdown by clicking the mini graph.
- Add your own spells using a simple spell formula system, like `My Spell: 2+2d4`.
- Add your own parameters to analyze in as much detail as you like.

### Usage

This is a tool made to calculate and compare the damage output of spells in role-playing games like Dungeons & Dragons.
To use it, you need to supply two things:

- Spell formulas: Which spells you want to analyze, and which parameters to play with. You can load spell presets or define your own using a special syntax.
- Parameters: What level are you casting your spells at? What is the AC of your enemies? How many enemies can you hit at once with area spells?
  Usually these questions cannot be answered precisely, but you can guess and see what happens.

The analysis box will update in real time against your modifications, estimating the damage for each of your spells.

### Parameters

Although you can define your own parameters to play around with, by default the D&D 5e spell list uses the following parameters:

- **Level**: Level at which you cast your spells. Remember that low-level spells can be cast at higher levels.
- **Targets**: For area spells, this indicates how many targets you expect to hit at once, and will multiply the damage accordingly.
- **Turns**: For spells that deal damage over time, this is the number of turns that you expect the spell to stay active, and will multiply the damage accordingly.
- **Spell mod**: Your spell modifier. This will affect the chance that attack rolls and enemy saving throws succeed or fail.
- **AC**: The average AC of your enemies. This will affect the chance that spell attack rolls succeed.
  In particular, the formula to succeed is `d20 + SpellMod >= AC`.
- **Skill saves**: The average modifier that your enemies apply to saving throws for specific skills. This affects the chance that saving throws fail.
  In particular, the formula for your enemy to fail is `d20 + SaveMod < 8 + SpellMod`.

### Analysis box

- **Spell name**: Names of the spells that are being analyzed. Each row represents one spell. Try clicking the names to pin spells!
- **Level**: Basic level of the spell. The spell cannot be casted below this level.
- **Average**: Average damage output of the spell. If you increase `targets`, this will sum damage to different creatures.
- **Deviation**: Standard deviation of the damage output. You should expect 70% of your spells to be in the range of average ± deviation.
- **Distribution**: Detailed distribution graph of the damage that each spell deals. The X axis is damage, and the Y axis is the probability to deal that damage.

Additionally,

- **Sort by damage**: Spells are sorted by highest average damage by default, but unchecking this box will freeze the current order.
  This allows you to play with the parameters without having the spells jump around.

### Defining your own spells

The damage for each spell is defined using a simple math-formula-like syntax.

You can define multiple spells in the text-box above, one per line.
Each spell should be of the form `Spell Name: damage expression`.

For example, to define a spell named `My Spell` that when used deals `2d6` of damage (ie. roll two 6-sided die, and the damage is the result of the sum):

```
My Spell: 2d6
```

You can also insert comments by using the `#` symbol.
All of the text to the right of a `#` symbol will be ignored.

```
# This is a comment
My Spell: 2d6
```

All 5 basic mathematical operators are also allowed, for example:

```
# A complex mathematical expression
Your Spell: (10^2 + 7/2) * 2 - 1
```

_(NOTE: All operations round decimals down.)_

Blanks between two terms are interpreted as multiplication.
For example, the following two spells are equivalent:

```
# Both of these spells are equivalent!
SpellOne: 1 2 3 4 5
SpellTwo: 1*2*3*4*5
```

In fact, `2d6` is simply shorthand for `2 * d6`.

One important note is that **order of multiplication matters**!
`2d6` means "roll two d6 and sum the result", while `d6 * 2` means "roll a d6 and multiply by 2".
This usually does not affect the average value of the damage, but it does affect the deviation and distribution of the damage.

You can also use functions like `max` or `min` using square brackets:

```
# This spell deals 1d10 damage, but if 1, 2 or 3 come up, it deals 4 damage instead
Safe spell: max[4][1d10]
```

#### Spell levels

Some spells change their damage depending on the level at which you cast them.
For example, let's say we have a level 2 spell that deals `3d6` damage when casted at level 2, `4d6` damage when casted at level 3, and so on.
We can express this using the `lvlN` keyword:

```
Level 2 Spell: (3 + lvl2) d6
```

Specifically `lvl2` is equal to `0` when the spell is casted at level 2. It is equal to `1` when casted at level 3, `2` when casted at level 4, etc.
Using the `lvl2` keyword in our spell also marks it as a level 2 spell, which cannot be casted at level 1.

This pattern of `x + lvlN` is so common, that it can also be written as `lvlN[x]`.

#### Parameters

You can add sliders and numerical inputs using parameter statements:

```
parameter[min=0][max=10] parameter_id ? Parameter Name = 0
#             ^      ^^                                  ^
#      minimum and maximum values                  default value
```

You can then use `parameter_id` in your formulas to stand in for the value of the parameter.

See more parameter sintax in the `Example` preset.

#### Definitions

If you use certain expressions often, you can give them a shorthand name using definitions:

```
define d20_with_advantage = max[d20][d20]
```

You can then use `d20_with_advantage` to refer to `max[d20][d20]`.

You can also define functions that accept parameters:

```
define add_and_multiply = fn x y { x + y + x*y }
```

You can then use `add_and_multiply` like `add_and_multiply[d8][d8]`.

### Syntax reference

- `dN` (where `N` is a number): Roll an `N` sided die.
- `lvlN` (where `N` is a number): Replaced by `0` if the spell is cast at its lowest level, and increases by 1 for each level above it.
  The engine decides the level of your spells based on the `lvlN` expressions that you use, so it is useful to add `+ 0 * lvlN` to spells that don't scale with level.
- `lvlN[x]` (where `x` is an expression): Equivalent to `(x + lvlN)`. Very useful for spells that go like "deals 3d6 damage, and 1 extra d6 for each level above", which can be expressed like `lvlN[3]d6`.
- `max[x][y][z]...` and `min[x][y][z]...`: Get the maximum/minimum between the arguments. Accepts an arbitrary number of arguments.
- `if[condition][true][false]`: If `condition` is a non-zero value, evaluates to `true`. Otherwise, evaluates to `false`.
- `fn x y z... { ... }`: Define a function (advanced). Functions can be called using square bracket syntax.
  Within a function, arguments are named and always behave like concrete numbers instead of probability distributions.
  This makes them very useful to model complex behavior like "roll d20 with disadvantage, but if both roll 1 then consider the result as a 20".
  This could be encoded by defining a function and calling it immediately:
  `(fn x y { if[max[x][y] == 1][ 20 ][ min[x][y] ] })[d20][d20]`

### D&D preset reference

- `str`, `dex`, `con`, `int`, `wis`, `cha`: Roll a saving throw. If the enemy fails, this is replaced by `1`. If the enemy succeeds, this is replaced by `0`.
  These take your Spell Modifier and the enemy's Saving Modifiers into account.
- `strh`, `dexh`, `conh`, `inth`, `wish`, `chah`: Roll a saving throw. If the enemy fails, this is replaced by `1`. If the enemy succeeds, this is replaced by `0.5`. Very useful for spells that state "takes half damage if they succeed a saving throw".
  Note that _all_ operations round down, even multiplication. This means that although `strh` is replaced by `0.5`, multiplying it with anything else will round down the result.
- `atk`: Similar to saving throws, `atk` rolls spell attacks. It is replaced by `1` if the spell attack succeeds, `0` if it fails and `2` if a critical hit happens (natural 20 roll).
  This takes your Spell Modifier and the enemy's AC into account.
- `area`: The "Area targets" parameter. If you multiply `area` by the rest of your spell's damage, it will multiply the damage result.
  Note that the ordering of `area` is important because of the order of multiplication.
  If the spell rolls a separate die/saving throw/spell attack for each target, `area` should appear at the begginning.
  If the spell rolls once and affects all targets equally, `area` should appear at the end.
- `time`: The "Turns" parameter. Allows you to multiply the damage of your spell if it deals damage over time.
  The same caveats on ordering that apply to `area` also apply to `time`.
