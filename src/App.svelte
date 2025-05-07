<script lang="ts">
  import { analyze } from "./engine/analyze";
  import Bar from "./lib/Bar.svelte";
  import type { Bundle } from "./lib/bundled";
  import * as bundled from "./lib/bundled";
  import Graph from "./lib/Graph.svelte";
  import { cmpKeyed } from "./engine/util";
  import Help from "./lib/Help.svelte";
  import { fade } from "svelte/transition";

  function formatDelta(x: number): string {
    return `${x >= 0 ? "+" : ""}${x.toFixed()}`;
  }

  const DRAFT_KEY: string = "draft-spell-collection-source";
  const PARAMS_KEY: string = "params-state";
  const SAVED_KEY: string = "saved-presets";
  const TOUCHED_KEY: string = "touched-features";

  type PopupState = { ty: "graph"; name: string; lineNum: number } | null;

  type ParamState = Record<string, number>;

  function loadFromLocalStorage<T>(key: string, dfault: T, name: string): T {
    let something: T = dfault;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        something = JSON.parse(stored);
      }
    } catch (e) {
      console.error(`Error loading ${name} from localStorage:`, e);
    }
    return something;
  }

  let saved = $state(
    loadFromLocalStorage<Bundle[]>(SAVED_KEY, [], "saved bundles"),
  );
  let touched = $state(
    loadFromLocalStorage<Record<string, boolean>>(
      TOUCHED_KEY,
      {},
      "touched features",
    ),
  );

  let src = $state(
    localStorage.getItem(DRAFT_KEY) || bundled.EXAMPLE.source.trim(),
  );
  let pstate: ParamState = $state(
    loadFromLocalStorage(PARAMS_KEY, {}, "parameter state"),
  );

  let analysis = $derived(analyze(src, new Map(Object.entries(pstate))));
  $inspect(analysis);

  $effect(() => {
    for (const group of analysis.wantParams) {
      for (const param of group.params) {
        if (!(param.id in pstate)) pstate[param.id] = param.default;
      }
    }
  });

  let popup: PopupState = $state(null);

  let freezeSort = $state(false);
  let sortOrder: Map<string, number> = $state(new Map());
  $effect(() => {
    if (!freezeSort) {
      sortOrder = new Map(
        analysis.spells.map((spell, idx) => [spell.name, idx]),
      );
    }
  });
  let spellAnalysisSorted = $derived.by(() => {
    const sorted = [...analysis.spells];
    sorted.sort(cmpKeyed((spell) => [sortOrder.get(spell.name) ?? -1]));
    return sorted;
  });

  let popupAnalysis = $derived.by(() => {
    if (popup?.ty !== "graph") return null;
    const p = popup;
    return analysis.spells.find((a) => a.name === p.name) ?? null;
  });

  $effect(() => {
    localStorage.setItem(DRAFT_KEY, src);
  });
  $effect(() => {
    localStorage.setItem(PARAMS_KEY, JSON.stringify(pstate));
  });
  $effect(() => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  });
  $effect(() => {
    localStorage.setItem(TOUCHED_KEY, JSON.stringify(touched));
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

  const TABLE_COLUMNS: string = "minmax(6em, 1fr) 2.5em 3.5em 3.5em 6em";

  function gridcell(row: number, column: number, odd?: boolean) {
    odd = odd ?? row % 2 !== 0;
    return `grid-column: ${column}; grid-row: ${row + 1}; background-color: ${odd ? "#303030" : "unset"};`;
  }
</script>

<main class="fdown facenter" style="gap: 1cm">
  <div id="analyze" class="analysis-parameters">
    <div class="analysis">
      <div class="fright facenter" style="justify-content: space-between;">
        <h2>Damage analysis</h2>
        <label>
          <input type="checkbox" bind:checked={freezeSort} />
          Freeze display order
        </label>
      </div>
      <div
        style="
        display: grid; gap: 2px; grid-template-columns: {TABLE_COLUMNS}; grid-auto-rows: min-content;
        "
      >
        <div class="cell">Spell</div>
        <div class="cell">Lvl</div>
        <div class="cell">Avg</div>
        <div class="cell">Dev</div>
        <div class="cell">Distribution</div>
      </div>
      <div
        style="
        border:1px solid #888; border-radius:3px; position:relative; overflow:hidden;
        display:flex; flex-direction:column; align-items:stretch; justify-content:stretch;
        "
      >
        <div
          style="
          display: grid; gap: 2px; grid-template-columns: {TABLE_COLUMNS}; grid-auto-rows: min-content;
          overflow-y: scroll;
          "
        >
          {#each spellAnalysisSorted as spell, i}
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
                : Math.round(spell.average * 10) / 10}
            </div>
            <div class="cell" style={gridcell(i, 4)}>
              <Bar full={(spell.stddev ?? 0) / maxStddev} />
              {spell.stddev == null ? "-" : Math.round(spell.stddev * 10) / 10}
            </div>
            <div class="cell" style="{gridcell(i, 5)}; padding: 0;">
              <button
                class="preset-button-bg"
                style="width: 100%; height: 100%; margin: 0; padding: 0; position: absolute; left: 0; top: 0; border: none;"
                onclick={() => {
                  popup = {
                    ty: "graph",
                    name: spell.name,
                    lineNum: spell.lineNum,
                  };
                }}
              >
                <Graph values={spell.damage} {maxValue} />
              </button>
            </div>
          {/each}
        </div>
        {#if popup}
          <div
            transition:fade|global={{ duration: 100 }}
            class="fdown facenter"
            style="
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #303030;
            "
          >
            <h2>{popupAnalysis?.name ?? "?"}</h2>
            <div
              style="
              margin: 0.5cm 0.5cm; position: relative; align-self: stretch; height: 8cm;
              background: #242424;
              "
            >
              <Graph
                values={popupAnalysis?.damage ?? new Map()}
                detail={true}
              />
            </div>
          </div>
          <button
            class="close-button"
            onclick={() => {
              popup = null;
            }}>X</button
          >
        {/if}
      </div>
    </div>
    <div class="spacer"></div>
    <div class="parameters" style="padding-bottom: 1em;">
      <div class="fright facenter" style="justify-content: space-between;">
        <h2>Parameters</h2>
        <a href="#help"> Help </a>
      </div>
      <div class="fdown facenter" style="gap: 0.3cm;">
        {#each analysis.wantParams as group}
          {#if group.params.length > 0}
            {#if group.name}
              <span style="margin: 0px;">{group.name}:</span>
            {/if}
            <div
              class="{group.attribs.flow === 'column'
                ? 'fdown'
                : 'fright'} facenter"
              style="gap: {group.attribs.flow === 'column' ? '0cm' : '1cm'};"
            >
              {#each group.params as param}
                {#if param.id in pstate && param.attribs.type === "number"}
                  <div class="fdown facenter" style="gap: 0cm;">
                    {param.humanName}
                    <input
                      type={param.attribs.type}
                      bind:value={pstate[param.id]}
                      min={param.attribs.min}
                      max={param.attribs.max}
                      step={param.attribs.step}
                      style="width: 1cm;"
                    />
                  </div>
                {/if}
                {#if param.id in pstate && param.attribs.type === "range"}
                  <div class="fright" style="gap: 0.2cm">
                    <span style="width: 6em; text-align: right;"
                      >{param.humanName}</span
                    >
                    <input
                      type="range"
                      bind:value={pstate[param.id]}
                      min={param.attribs.min}
                      max={param.attribs.max}
                      step={param.attribs.step}
                      style="touch-action: none;"
                    />
                    <span style="width: 50px; text-align: left;">
                      {param.attribs.min < 0
                        ? formatDelta(pstate[param.id])
                        : pstate[param.id]}
                    </span>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <div id="presets" class="fdown facenter">
    <h2>Spell presets</h2>
    <div class="fright facenter" style="gap: 0.25cm; flex-wrap: wrap;">
      {#each bundled.BUNDLES as bundle}
        <button
          class="
          preset-button preset-button-bg
          {`bundle-${bundle.name}` in touched ? '' : 'shiny-and-new'}
          "
          onmouseenter={() => {
            touched[`bundle-${bundle.name}`] = true;
          }}
          onclick={() => {
            if (
              !bundled.BUNDLES.concat(saved).some(
                (someBundle) => someBundle.source.trim() === src.trim(),
              )
            ) {
              touched[`bundle-${bundle.name}`] = true;
              const confirmed = confirm(
                "Loading a preset will delete your current spells. Do you still want to continue?",
              );
              if (!confirmed) return;
            }
            src = bundle.source.trim();
          }}
        >
          {bundle.name}
        </button>
      {/each}
    </div>
    <div class="fright facenter" style="gap: 0.25cm; flex-wrap: wrap;">
      {#each saved as bundle, bundleIdx}
        <div class="preset-button" style="background: none;">
          <button
            class="preset-button-bg"
            style="border: none; padding-left: 1em; padding-right: 1em;"
            onclick={() => {
              if (
                !bundled.BUNDLES.concat(saved).some(
                  (someBundle) => someBundle.source.trim() === src.trim(),
                )
              ) {
                const confirmed = confirm(
                  "Loading a preset will delete your current spells. Do you still want to continue?",
                );
                if (!confirmed) return;
              }
              src = bundle.source.trim();
            }}
          >
            {bundle.name}
          </button>
          <button
            class="preset-button-bg"
            style="border: none;"
            onclick={() => {
              const confirmed = confirm(
                `Do you want to delete the preset "${bundle.name}"?`,
              );
              if (!confirmed) return;
              saved.splice(bundleIdx, 1);
            }}
          >
            🗑️
          </button>
        </div>
      {/each}
      <button
        class="preset-button preset-button-bg"
        style="width: 1.75em;"
        onclick={() => {
          const exists = bundled.BUNDLES.concat(saved).find(
            (someBundle) => someBundle.source.trim() === src.trim(),
          );
          if (exists) {
            alert(
              `The current spell list is already saved as "${exists.name}"`,
            );
            return;
          }
          const name = prompt("How do you want to name this spell list?");
          if (!name) return;
          saved.push({
            name,
            source: src,
          });
        }}>+</button
      >
    </div>
  </div>

  <div id="spelldef" class="fdown facenter">
    <h2>Spell definitions</h2>
    <p style:padding="0 0.5em">
      Enter your spell collection, following the example format. See
      <a href="#help">help</a>
      below.
    </p>
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

  <div id="help" class="fdown facenter">
    <h2>Help</h2>
    <Help />
  </div>

  <span style="margin-bottom: 0.5em; opacity: 0.5;">
    Made by <a href="https://github.com/kovaxis">kovaxis</a> @ 2025.
    <a href="https://github.com/kovaxis/dndcalc">Open source</a>.
  </span>
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

  .close-button {
    position: absolute;
    top: 1em;
    right: 1em;
    appearance: none;
    background: #222;
    border: none;
    color: #fff;
    border-radius: 50%;
    width: 2em;
    height: 2em;
    font-weight: 900;
  }
  .close-button:hover {
    background: #333;
  }
  .close-button:active {
    background: #666;
  }

  .preset-button {
    appearance: none;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin: 0.25em;
    border-radius: 5px;
    width: fit-content;
    height: fit-content;
    border: 1px solid #8f8f9d;
    overflow: hidden;
    color: #fff;
  }
  .preset-button:hover {
    border: 1px solid #babac6;
  }
  .preset-button:active {
    border: 1px solid #dfdfe6;
  }

  .preset-button-bg {
    font-size: 24px;
    padding: 0.25em;
    background: #2b2a33;
  }
  .preset-button-bg:hover {
    background: #575662;
  }
  .preset-button-bg:active {
    background: #757481;
  }

  .shiny-and-new {
    background: linear-gradient(
      90deg,
      #ff2400,
      #e81d1d,
      #e8b71d,
      #e3e81d,
      #1de840,
      #1ddde8,
      #2b1de8,
      #dd00f3,
      #dd00f3,
      #ff2400
    );
    background-size: 300% 300%;
    animation: rainbow 10s linear infinite;
  }

  @keyframes rainbow {
    0% {
      background-position: 0% 0%;
    }
    100% {
      background-position: 300% 0%;
    }
  }
</style>
