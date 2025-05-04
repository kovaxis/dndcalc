<script lang="ts">
  import { analyze } from "./lib/analyze";
  import { SKILLS } from "./lib/ast";
  import Bar from "./lib/Bar.svelte";
  import * as bundled from "./lib/bundled";
  import type { Params } from "./lib/eval";
  import Graph from "./lib/Graph.svelte";

  function formatDelta(x: number): string {
    return `${x > 0 ? "+" : ""}${x.toFixed()}`;
  }

  const DRAFT_KEY: string = "draft-spell-collection-source";
  const PARAMS_KEY: string = "params-state";

  interface State extends Omit<Params, "chances"> {
    spellmod: number;
    skills: Params["chances"];
  }

  function loadStateFromLocalStorage(): State {
    let params: State = {
      spellmod: 0,
      skills: Object.fromEntries(
        SKILLS.map((skill) => [skill, skill === "atk" ? 10 : 0]),
      ),
      targets: 1,
      time: 1,
      level: 1,
    };
    try {
      const stored = localStorage.getItem(PARAMS_KEY);
      if (stored) {
        params = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error loading state from localStorage:", e);
    }
    return params;
  }

  let src = $state(localStorage.getItem(DRAFT_KEY) || bundled.EXAMPLE);
  let pstate: State = $state(loadStateFromLocalStorage());
  let analysis = $derived(
    analyze(src, {
      ...pstate,
      chances: Object.fromEntries(
        Object.entries(pstate.skills).map(([skill, skillmod]) => {
          // to succeed skillcheck: d20 + skillmod < 8 + spellmod
          // d20 <= spellmod - skillmod + 7
          // to succeed atk: d20 + spellmod >= ac
          // d20 >= ac - spellmod
          // 21 - d20 <= 21 + spellmod - ac
          // d20 <= 21 - ac + spellmod
          const lessthan =
            skill === "atk"
              ? 21 - skillmod + pstate.spellmod
              : pstate.spellmod - skillmod + 7;
          return [skill, Math.max(Math.min(lessthan, 20), 0) / 20];
        }),
      ),
    }),
  );
  $effect(() => {
    localStorage.setItem(DRAFT_KEY, src);
  });
  $effect(() => {
    localStorage.setItem(PARAMS_KEY, JSON.stringify(pstate));
  });

  const maxLevel = $derived(
    Math.max(1, ...analysis.spells.map((spell) => spell.level ?? 0)),
  );
  const maxAverage = $derived(
    Math.ceil(
      Math.max(1, ...analysis.spells.map((spell) => spell.average ?? 0)),
    ),
  );
  const maxStddev = $derived(
    Math.ceil(
      Math.max(1, ...analysis.spells.map((spell) => spell.stddev ?? 0)),
    ),
  );
  const maxValue = $derived(
    Math.ceil(Math.max(1, ...analysis.spells.map((spell) => spell.max ?? 0))),
  );

  const TABLE_COLUMNS: string = "minmax(12em, 1fr) 3em 5em 5em 6em";

  function gridcell(row: number, column: number) {
    return `grid-column: ${column}; grid-row: ${row + 1}; background-color: ${row % 2 ? "#303030" : ""}`;
  }
</script>

<main class="fdown facenter" style="gap: 1cm">
  <div class="analysis-parameters">
    <div class="analysis">
      <h2>Damage analysis</h2>
      <div
        style="
        display: grid; gap: 2px; grid-template-columns: {TABLE_COLUMNS}; grid-auto-rows: min-content;
        "
      >
        <div class="cell">Spell</div>
        <div class="cell">Level</div>
        <div class="cell">Average</div>
        <div class="cell">Deviation</div>
        <div class="cell">Distribution</div>
      </div>
      <div
        style="
        display: grid; gap: 2px; grid-template-columns: {TABLE_COLUMNS}; grid-auto-rows: min-content; overflow-y: scroll;
        border: 1px solid #888; border-radius: 1em;
        "
      >
        {#each analysis.spells as spell, i}
          <div class="cell" style={gridcell(i, 1)}>{spell.name}</div>
          <div class="cell" style={gridcell(i, 2)}>
            <Bar full={(spell.level ?? 0) / maxLevel} />
            <span style:color={spell.level == null ? "red" : undefined}>
              {spell.level ?? "?"}
            </span>
          </div>
          <div class="cell" style={gridcell(i, 3)}>
            <Bar full={(spell.average ?? 0) / maxAverage} />
            {spell.average == null
              ? "-"
              : Math.round(spell.average * 100) / 100}
          </div>
          <div class="cell" style={gridcell(i, 4)}>
            <Bar full={(spell.stddev ?? 0) / maxStddev} />
            {spell.stddev == null ? "-" : Math.round(spell.stddev * 100) / 100}
          </div>
          <div class="cell" style={gridcell(i, 5)}>
            <Graph values={spell.damage} {maxValue} />
          </div>
        {/each}
      </div>
    </div>
    <div class="spacer"></div>
    <div class="parameters" style="padding-bottom: 1em;">
      <h2>Parameters</h2>
      <div class="fdown facenter" style="gap: 0.5cm;">
        <div class="fright" style="gap: 1cm;">
          <div class="fdown facenter" style="gap: 0cm;">
            Level
            <input
              type="number"
              bind:value={pstate.level}
              min="1"
              max="9"
              style="width: 1cm;"
            />
          </div>
          <div class="fdown facenter" style="gap: 0cm;">
            Targets
            <input
              type="number"
              bind:value={pstate.targets}
              min="1"
              style="width: 1cm;"
            />
          </div>
          <div class="fdown facenter" style="gap: 0cm;">
            Turns
            <input
              type="number"
              bind:value={pstate.time}
              min="1"
              style="width: 1cm;"
            />
          </div>
        </div>
        <div class="fdown facenter">
          Your attributes:
          <div class="fright" style="gap: 0.2cm">
            <span style="width: 6em; text-align: right;">Spell mod</span>
            <input
              type="range"
              bind:value={pstate.spellmod}
              min="-10"
              max="10"
              step="1"
            />
            <span style="width: 50px; text-align: left;">
              {formatDelta(pstate.spellmod)}
            </span>
          </div>
        </div>
      </div>
      <div class="fdown facenter">
        Enemy attributes:
        {#each SKILLS as skill}
          <div class="fright" style="gap: 0.2cm;">
            <span style="width: 6em; text-align: right;">
              {skill === "atk" ? "AC" : `${skill.toUpperCase()} save`}
            </span>
            <input
              type="range"
              bind:value={pstate.skills[skill]}
              min={skill === "atk" ? 10 : -10}
              max={skill === "atk" ? 30 : 10}
              step="1"
            />
            <span style="width: 50px; text-align: left;">
              {skill === "atk"
                ? pstate.skills[skill]
                : formatDelta(pstate.skills[skill])}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="fdown facenter">
    <h2>Spell definitions</h2>
    Enter your spell collection, following the example format. See help below.
    <textarea
      bind:value={src}
      style="display: block; width: min(90vw, 100vh); height: 50vh;"
    ></textarea>
    {#if analysis.errors.length > 0}
      <h2>Errors:</h2>
      {#each analysis.errors as err}
        <p style="color: red;">{err}</p>
      {/each}
    {/if}
  </div>

  <div class="fdown facenter">
    <h2>Help</h2>
    <ul>
      <li>MOD: Your spell sa</li>
    </ul>
  </div>
</main>

<style>
  h2 {
    margin: 0px;
  }

  .cell {
    position: relative;
    min-width: 0px;
    min-height: fit-content;
    overflow-x: hidden;
    text-wrap: wrap;
    overflow-wrap: anywhere;
    padding: 0 0.25em;
  }

  .analysis {
    display: flex;
    flex-direction: column;
    padding: 0px 1em;
    overflow: hidden;
  }
  .parameters {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  @media (orientation: landscape) {
    .analysis-parameters {
      width: 100%;
      display: flex;
      flex-direction: row;
      justify-content: center;
    }
    .spacer {
      max-width: 3cm;
      flex: 1 1 0;
    }
    .analysis {
      max-height: 90vh;
    }
  }

  @media (orientation: portrait) {
    .analysis-parameters {
      display: flex;
      flex-direction: column;
      max-height: 100vh;
    }
    .analysis {
      flex: 1 1 auto;
    }
    .spacer {
      display: none;
    }
    .parameters {
      flex: 0 0 auto;
    }
  }
</style>
