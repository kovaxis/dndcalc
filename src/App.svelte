<script lang="ts">
  import { analyze } from "./lib/analyze";
  import { SKILLS } from "./lib/ast";
  import * as bundled from "./lib/bundled";
  import type { Params } from "./lib/eval";

  const DRAFT_KEY: string = "draft-spell-collection-source";

  let src = $state(localStorage.getItem(DRAFT_KEY) || bundled.EXAMPLE);
  let params: Params = $state({
    chances: Object.fromEntries(SKILLS.map((skill) => [skill, 0.5])),
    targets: 1,
    time: 1,
    level: 1,
  });
  let analysis = $derived(analyze(src, params));
  $effect(() => {
    localStorage.setItem(DRAFT_KEY, src);
  });
</script>

<main class="fdown facenter">
  Enter your spell collection, following the example format:
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
  <h2>Analysis:</h2>
  <div class="fdown" style="overflow: auto; max-height:70vh;">
    <table>
      <thead>
        <tr>
          <th>Spell</th>
          <th>Level</th>
          <th>Expected damage</th>
        </tr>
      </thead>
      <tbody>
        {#each analysis.spells as spell}
          <tr>
            <td>{spell.name}</td>
            <td>
              <span style:color={spell.level == null ? "red" : undefined}
                >{spell.level ?? "?"}</span
              >
            </td>
            <td>{spell.average}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <h2>Parameters:</h2>
  <div class="fdown facenter" style="gap: 0.5cm;">
    <div class="fdown facenter" style="gap: 0cm;">
      Level:
      <input
        type="number"
        bind:value={params.level}
        min="1"
        max="9"
        style="width: 1cm;"
      />
    </div>
    <div class="fdown facenter" style="gap: 0cm;">
      Number of targets:
      <input
        type="number"
        bind:value={params.targets}
        min="1"
        style="width: 1cm;"
      />
    </div>
    <div class="fdown facenter">
      Success chance:
      {#each Object.keys(params.chances) as skill}
        <div class="fright" style="gap: 0.2cm;">
          <span style="width: 50px; text-align: right;">
            {skill.toUpperCase()}
          </span>
          <input
            type="range"
            bind:value={params.chances[skill]}
            min="0"
            max="1"
            step="0.1"
          />
          <span style="width: 50px; text-align: left;">
            {Math.round(params.chances[skill] * 100)}%
          </span>
        </div>
      {/each}
    </div>
  </div>
</main>

<style>
</style>
