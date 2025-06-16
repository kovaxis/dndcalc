<script lang="ts">
  export interface Props {
    source: string;
  }
  let props: Props = $props();
</script>

<div style="padding: 0 0.5em;">
  <span style="margin-right:0.5em;"> Formula: </span>
  <tt>
    {props.source}
  </tt>
</div>
