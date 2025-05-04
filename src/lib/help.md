### Quick start

1. Select your favorite set of spells from the [presets](#presets) above.
2. Check the average damage output for each spell in the [damage analysis window](#analyze).
3. Play around with parameters like your Spell Modifier, your enemies' AC, Saving Throw Modifiers, the level you cast your spells at, etc...


### Usage

This is a tool made to calculate the damage output of spells in Dungeons & Dragons (5th edition). To use it, you need to supply two things:

- Spell definitions: Which spells you want to analyze. You can load spell presets or define your own using a special syntax.
- Parameters: What level are you casting your spells at? What is the AC of your enemies? How many enemies can you hit at once with area spells?
    Usually these questions cannot be answered precisely, but you can guess and see what happens.

The analysis window will update in real time against your modifications, estimating the damage for each of your spells.

### Parameters

- **Level**: Level at which you cast your spells. Remember that low-level spells can be cast at higher levels.
- **Targets**: For area spells, this indicates how many targets you expect to hit at once, and will multiply the damage accordingly.
- **Turns**: For spells that deal damage over time, this is the number of turns that you expect the spell to stay active, and will multiply the damage accordingly.
- **Spell mod**: Your spell modifier. This will affect the chance that attack rolls and enemy saving throws succeed or fail.
- **AC**: The average AC of your enemies. This will affect the chance that spell attack rolls succeed.
    In particular, the formula to succeed is `d20 + SpellMod >= AC`.
- **Skill saves**: The average modifier that your enemies apply to saving throws for specific skills. This affects the chance that saving throws fail.
    In particular, the formula for your enemy to fail is `d20 + SaveMod < 8 + SpellMod`.

### Analysis window

- **Spell name**: Names of the spells that are being analyzed. Each row represents one spell.
- **Level**: Basic level of the spell. The spell cannot be casted below this level.
- **Average**: Average damage output of the spell. If you increase `targets`, this will sum damage to different creatures.
- **Deviation**: Standard deviation of the damage output. You should expect 70% of your spells to be in the range of average ± deviation.
- **Distribution**: Detailed distribution graph of the damage that each spell deals. The X axis is damage, and the Y axis is the probability to deal that damage.

Additionally,

- **Freeze display order**: Spells are sorted by highest average damage by default, but checking this box will freeze the current order.
    This allows you to play with the parameters while keeping an eye on particular spells.

### Defining your own spells

The damage for each spell is defined using a simple math-like syntax.

You can define multiple spells in the text-box above, one per line.
Each spell should be of the form `Spell Name: damage expression`.
You can also insert comments by using the `#` symbol.
After encountering a `#` symbol, the engine will skip the rest of the line.

For example, to define a spell named `My Spell` that when used deals `2d6` of damage (ie. roll two 6-sided die, and the damage is the result of the sum):

```
My Spell: 2d6
```

All 5 basic mathematical operators are also allowed, for example:

```
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
`2d6` means "rolls two d6 and sum the result", while `d6 * 2` means "roll a d6 and multiply by 2".
This distinction does not affect the average value of the damage, but it does affect the deviation and distribution of the damage.

You can also roll saving throws:

```
My Attack: dex 2d6
```

In this case, `dex` is replaced by `1` if your enemy fails the saving throw, and by `0` if they succeed.

### Syntax reference

- `dN` (where `N` is a number): Roll an `N` sided die.
- `str`, `dex`, `con`, `int`, `wis`, `cha`: Roll a saving throw. If the enemy fails, this is replaced by `1`. If the enemy succeeds, this is replaced by `0`.
- `strh`, `dexh`, `conh`, `inth`, `wish`, `chah`: Roll a saving throw. If the enemy fails, this is replaced by `1`. If the enemy succeeds, this is replaced by `0.5`. Very useful for spells that state "takes half damage if they succeed a saving throw".
    Note that _all_ operations round down, even multiplication. This means that although `strh` is replaced by `0.5`, using it will round down the result (after performing the operation, of course).
- `atk`: Similar to saving throws, `atk` rolls spell attacks. It is replaced by `1` if the spell attack succeeds, and `0` if it fails.
    There is also an `atkh` variation that takes the values `1` or `0.5` instead.
- `area`: The `area` keyword is replaced by the `targets` parameter. If you multiply `area` by the rest of your spell's damage, it will multiply the damage result.
    Note that the ordering of `area` is important.
    If the spell rolls a separate die/saving throw/spell attack for each target, `area` should appear at the begginning.
    If the spell rolls once and affects all targets equally (most spells), `area` should appear at the end.
- `time`: The `time` keyword is replaced by the `turns` parameter, which allows you to multiply the damage of your spell if it deals damage over time.
    The same caveats on ordering that apply to `area` also apply to `time`.
- `lvlN` (where `N` is a number): Replaced by `0` if the spell is cast at its lowest level, and increases by 1 for each level above it.
    The engine decides the level of your spells based on the `lvlN` expressions that you use, so it is useful to add `+ 0 * lvlN` to spells that don't scale with level.
- `lvlN[x]` (where `x` is an expression): Equivalent to `(x + lvlN)`. Very useful for spells that go like "deals 3d6 damage, and 1 extra d6 for each level above", which can be expressed like `lvlN[3]d6`.
- `max[x][y][z]...` and `min[x][y][z]...`: Get the maximum/minimum between the arguments. You must supply at least 2 arguments, but there is no uppper bound.
