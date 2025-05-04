<script lang="ts">
    export interface Props {
        values: Map<number, number>;
        opacity?: number;
        color?: string;
        maxValue?: number;
    }
    const props: Props = $props();
    const maxValue = $derived(
        props.maxValue ?? Math.max(0, ...props.values.keys()),
    );
    const maxProb = $derived(Math.max(0, ...props.values.values()));
    const table = $derived(
        [...Array(maxValue + 1)].map((_, idx) => {
            // return 1;
            return (props.values.get(idx) ?? 0) / (maxProb || 1);
        }),
    );
</script>

<svg
    viewBox="0 0 {maxValue + 1} 1"
    preserveAspectRatio="none"
    shape-rendering="crispEdges"
    style="
    position: absolute; left: 0; top: 0; width: 100%; height: 100%;
    opacity: {props.opacity ?? 1}; fill: {props.color ?? 'green'};
    "
>
    {#each table as probability, idx}
        <rect x={idx} y={1 - probability} width="1" height={probability} />
    {/each}
</svg>
