<script lang="ts">
    // Projeto Live: máscara da saída (painéis de LED). Fora das formas fica preto; dentro aparece o que
    // estiver na saída. As formas usam frações (0 a 1) da tela; o PNG vai por cima do jeito que é
    // (preto onde esconde, transparente onde mostra).
    import type { PLMascara } from "../../../../types/Output"
    import { encodeFilePath } from "../../helpers/media"
    import { caminhoRet, cantosDe } from "../../drawer/mascaras/mascaras"

    export let mascara: PLMascara | null | undefined
    export let width = 1920
    export let height = 1080
    export let editor = false // no editor, o "fora" fica meio transparente para ver as formas

    const maskId = "plmask" + Math.random().toString(36).slice(2, 8)

    $: formas = mascara?.formas || []
</script>

{#if mascara && (formas.length || mascara.png)}
    <div class="mascara" class:editor>
        {#if formas.length}
            <svg viewBox="0 0 {width} {height}" preserveAspectRatio="none" width="100%" height="100%">
                <defs>
                    <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" {width} {height}>
                        <rect x="0" y="0" {width} {height} fill="white" />
                        {#each formas as f}
                            {#if f.tipo === "circ"}
                                <ellipse cx={(f.x + f.w / 2) * width} cy={(f.y + f.h / 2) * height} rx={(f.w / 2) * width} ry={(f.h / 2) * height} fill="black" />
                            {:else}
                                <path d={caminhoRet(f.x * width, f.y * height, f.w * width, f.h * height, cantosDe(f))} fill="black" />
                            {/if}
                        {/each}
                    </mask>
                </defs>
                <rect x="0" y="0" {width} {height} fill="black" mask="url(#{maskId})" />
            </svg>
        {/if}
        {#if mascara.png}
            <img src={encodeFilePath(mascara.png)} alt="" draggable="false" style="object-fit: {mascara.pngAjuste || 'contain'};" />
        {/if}
    </div>
{/if}

<style>
    .mascara {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }
    .mascara.editor {
        opacity: 0.75;
    }
    svg,
    img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }
</style>
