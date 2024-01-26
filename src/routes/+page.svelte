<script>
    import '$lib/global.css';
    import { onMount, onDestroy } from "svelte";

    let Frames;

    onMount(async function() {
        Frames = (await import('$lib/frames/Frames.svelte')).default;
    });

    onDestroy(function() {
        //
    });
</script>

<div class="w-100 col center">
    <svelte:component this={ Frames }></svelte:component>
</div>
