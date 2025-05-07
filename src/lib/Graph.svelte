<script lang="ts">
    export interface Props {
        values: Map<number, number>;
        opacity?: number;
        color?: string;
        maxValue?: number;
        detail?: boolean;
    }
    const props: Props = $props();
    const maxValue = $derived(
        props.maxValue ?? Math.max(0, ...props.values.keys()),
    );
    const n = $derived(maxValue + 1);
    const maxProb = $derived(Math.max(0, ...props.values.values()));
    const table = $derived(
        [...Array(n)].map((_, idx) => {
            return props.values.get(idx) ?? 0;
        }),
    );

    const fontSize = 20;

    const ranges = $derived.by(() => {
        const ranks: number[] = [];
        for (let i = 0; i <= n; i++) {
            ranks.push(
                -0.02 *
                    Math.abs(
                        (table[i] ?? table[n - 1] + 0.02) -
                            (table[i - 1] ?? table[0] + 0.02),
                    ) +
                    Math.min(table[i] ?? Infinity, table[i - 1] ?? Infinity),
            );
            console.log("rank", i, ":", ranks[i]);
        }

        const splits = [];
        const radius = Math.ceil(n * 0.1);
        for (let i = 0; i <= n; i++) {
            let ismin = true;
            for (
                let j = Math.max(0, i - radius);
                j <= Math.min(n, i + radius);
                j++
            ) {
                if (
                    j !== i &&
                    (ranks[j] < ranks[i] || (ranks[j] === ranks[i] && j < i))
                ) {
                    ismin = false;
                }
            }
            if (ismin) {
                splits.push(i);
            }
        }
        if (splits[0] !== 0) splits.unshift(0);
        if (splits[splits.length - 1] !== n) splits.push(n);

        const ranges: [number, number][] = [];
        for (let j = 1; j < splits.length; j++) {
            ranges.push([splits[j - 1], splits[j]]);
        }
        return ranges;
    });

    let w = $state(1);
    let hRaw = $state(1);
    let h = $derived(hRaw - (props.detail ? fontSize : 0));
</script>

<svg
    viewBox="0 0 {w} {hRaw}"
    bind:clientWidth={w}
    bind:clientHeight={hRaw}
    preserveAspectRatio="none"
    shape-rendering="crispEdges"
    style="
    position: absolute; left: 0; top: 0; width: 100%;
    height: calc(100%{props.detail ? ` + ${fontSize}px` : ''});
    opacity: {props.opacity ?? 1}; fill: {props.color ?? 'green'};
    "
>
    {#each table as probability, idx}
        {@const z = probability / maxProb}
        <rect x={(w * idx) / n} y={h * (1 - z)} width={w / n} height={h * z} />
    {/each}
    {#if props.detail}
        {#each ranges as [l, r]}
            {@const prob = table
                .slice(l, r)
                .reduce((prev, prob) => prev + prob, 0)}
            {@const avg =
                table
                    .slice(l, r)
                    .reduce((acc, prob, val) => acc + val * prob, 0) /
                    (prob || 1) +
                l}
            {@const z = prob / (r - l) / maxProb}
            {@const xTextIdeal = (w * (avg + 0.5)) / n}
            {@const xText =
                xTextIdeal < fontSize
                    ? 0
                    : xTextIdeal > w - fontSize
                      ? w
                      : xTextIdeal}
            {@const xTextAlign =
                xTextIdeal < fontSize
                    ? "start"
                    : xTextIdeal > w - fontSize
                      ? "end"
                      : "middle"}
            <text
                fill="#fff"
                x={xText}
                text-anchor={xTextAlign}
                y={h * (1 - z) + (z > 0.7 ? fontSize : -3)}
                font-size={fontSize}
            >
                {Math.round(prob * 100)}%
            </text>
            <text
                fill="#fff"
                x={xText}
                text-anchor={xTextAlign}
                y={h + fontSize}
                font-size={fontSize}
            >
                {Math.round(avg * 10) / 10}
            </text>
            <line
                x1={(w * l) / n}
                y1={h * (1 - z)}
                x2={(w * r) / n}
                y2={h * (1 - z)}
                style="stroke:white;stroke-width:1;"
            />
            <line
                x1={(w * (avg + 0.5)) / n}
                y1={h * (1 - z)}
                x2={(w * (avg + 0.5)) / n}
                y2={h}
                style="stroke:white;stroke-width:1;"
            />
        {/each}
    {/if}
</svg>
