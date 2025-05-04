<script lang="ts">
    export interface Props {
        full: number;
        opacity?: number;
        color?: string;
    }
    const props: Props = $props();
</script>

<div
    style="
    position: absolute;
    opacity: {props.opacity ?? 0.2};
    background: {props.color ?? 'green'};
    height: 100%; left: 0px; top: 0px; width: {Math.round(props.full * 100)}%;"
></div>
