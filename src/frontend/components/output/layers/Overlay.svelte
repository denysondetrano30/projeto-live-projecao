<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Item, Transition } from "../../../../types/Show"
    import { shouldItemBeShown } from "../../edit/scripts/itemHelpers"
    import { clone } from "../../helpers/array"
    import Textbox from "../../slide/Textbox.svelte"
    import SlideItemTransition from "../transitions/SlideItemTransition.svelte"
    import { outputs } from "../../../stores"
    import { getOutputResolution } from "../../helpers/output"
    import { ajusteDaSaida, estiloDoEmbrulho, saidaDoOutput } from "../../../utils/projetoLiveSobreposicao"
    import type { SaidaPl } from "../../../utils/projetoLiveSobreposicao"

    export let outputId: string
    export let isClearing = false

    export let id: string = ""
    export let overlay: { items: Item[]; [key: string]: any }
    export let mirror = false
    export let preview = false
    export let transition: Transition
    export let styleIdOverride = ""
    // Projeto Live (somun tela): ajuste por saída; plSaida/plResolucao só na prévia da janela de ajuste
    export let plSaida: SaidaPl | "" = ""
    export let plResolucao: { width: number; height: number } | null = null

    $: transitionEnabled = !!((transition.type !== "none" && transition.duration) || transition.in || transition.out)

    let currentItems: Item[] = []
    let show = false

    $: if (overlay?.items !== undefined && JSON.stringify(overlay.items) !== JSON.stringify(currentItems)) updateItems()

    // WIP similar to SlideContent.svelte
    let timeout: NodeJS.Timeout | null = null
    function updateItems() {
        show = false

        // wait for previous items to start fading out (svelte will keep them until the transition is done!)
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => {
            currentItems = clone(overlay.items || [])
            show = true
        })
    }

    const showItemRef = { outputId, type: "default" }
    let conditionsUpdater = 0
    let isMic = false
    $: isMic = JSON.stringify(currentItems.map((a) => a?.conditions) || "").includes('"element":"volume"')

    let updaterInterval: NodeJS.Timeout
    $: {
        clearInterval(updaterInterval)
        updaterInterval = setInterval(
            () => {
                if (isClearing || !Array.isArray(currentItems)) return
                if (currentItems.find((a) => a?.conditions)) conditionsUpdater++
            },
            isMic ? 100 : 300
        )
    }
    onDestroy(() => clearInterval(updaterInterval))

    // Projeto Live (somun tela): sobreposição por saída (mostrar, lugar, tamanho e margem, sem esticar)
    $: plSaidaAtual = plSaida || saidaDoOutput(outputId)
    $: plAjuste = ajusteDaSaida(overlay, plSaidaAtual)
    $: plRes = plResolucao || getOutputResolution(outputId, $outputs, true)
    $: plAltura = plRes?.width ? (1920 * plRes.height) / plRes.width : 1080
    $: plEmbrulho = plAjuste && plAjuste.mostrar !== false ? estiloDoEmbrulho(overlay?.items, plAjuste, 1920, plAltura) : ""
    $: plEscondida = plAjuste?.mostrar === false
</script>

{#if !plEscondida}
<div class="plEmbrulho" style={plEmbrulho || "display: contents;"}>
{#key show}
    {#each currentItems as item}
        {#if show && shouldItemBeShown(item, [], showItemRef, conditionsUpdater)}
            {@const itemTransitionEnabled = (!mirror || preview) && transitionEnabled}

            <SlideItemTransition transitionEnabled={itemTransitionEnabled} {isClearing} {preview} globalTransition={transition} {item} let:customItem>
                <Textbox item={customItem} ref={{ type: "overlay", id }} {mirror} {preview} {outputId} {styleIdOverride} updateDynamicValues={!isClearing} plSemEsticar={!!plEmbrulho} />
            </SlideItemTransition>
        {/if}
    {/each}
{/key}
</div>
{/if}
