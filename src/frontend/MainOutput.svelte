<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { fade } from "svelte/transition"
    import { OUTPUT } from "../types/Channels"
    import type { Resolution } from "../types/Settings"
    import { getResolution } from "./components/helpers/output"
    import Output from "./components/output/Output.svelte"
    import { getStyleResolution } from "./components/slide/getStyleResolution"
    import StageLayout from "./components/stage/StageLayout.svelte"
    import { currentWindow, livePrepare, outputs, presenting, special, styles } from "./stores"
    import { onStreamFrame } from "./utils/streamPort"
    import { StreamCanvasRenderer } from "./components/drawer/live/streamCanvas"
    import { hideDisplay } from "./utils/common"
    import { send } from "./utils/request"
    import { gradienteFusao, mapaAtivo, matrizCantos } from "./components/drawer/mascaras/mapa"

    $: outputId = Object.keys($outputs)[0]

    $: sceneStyleId = $outputs[outputId]?.out?.scene?.style

    // get output resolution
    let width = 0
    let height = 0
    let resolution: Resolution = getResolution()
    $: if ($currentWindow === "output") resolution = getResolution(null, { $outputs, $styles }, true, "", sceneStyleId)

    // $: outputStyle = getCurrentStyle($styles, $outputs[outputId]?.style)

    // enable output window dragging
    let enableOutputMove = false
    function mousemoveOutput(e: MouseEvent) {
        if ($outputs[outputId]?.boundsLocked || $special.hideCursor) return
        if (e.ctrlKey || e.metaKey || e.target?.closest(".dragger")) enableOutputMove = true
        else enableOutputMove = false
    }
    $: if ($currentWindow === "output") send(OUTPUT, ["MOVE"], { enabled: enableOutputMove })

    // presenter mode: draw the capture's frames instead of rendering the content
    let presentCanvas: HTMLCanvasElement | null = null
    const presentRenderer = new StreamCanvasRenderer()
    let unlistenPresent: (() => void) | null = null
    $: listenPresent($presenting)
    function listenPresent(active: boolean) {
        unlistenPresent?.()
        unlistenPresent = null
        if (!active) return
        unlistenPresent = onStreamFrame("PRESENT", ({ frame }) => {
            if (presentCanvas) presentRenderer.draw(presentCanvas, frame)
        })
    }
    onDestroy(() => {
        unlistenPresent?.()
        presentRenderer.destroy()
    })

    // make sure it's loaded to prevent output not changing to stage output because of Svelte transition bug
    let loaded = false
    onMount(() => {
        setTimeout(() => {
            loaded = true
        }, 2000)
    })

    // reports whether the page is animating and a hash of its still content, for main's render sharing
    let rootEl: HTMLElement | null = null
    let reported = ""
    // seq of the last applied message
    let appliedSeq = 0
    let checkQueued = false
    function queueCheck() {
        if (checkQueued) return
        checkQueued = true
        // next task, so a burst of changes is checked once
        setTimeout(reportState, 0)
    }
    function reportState() {
        checkQueued = false
        if (!outputId || !rootEl) return
        // a canvas drawn every frame (effects) is never still
        const busy = document.getAnimations().some((a) => a.playState === "running") || !!rootEl.querySelector("[data-animated]")
        // markup without element ids (some random) or this output's id, which differ between identical pages
        const dom = busy ? "" : contentHash(rootEl.innerHTML.replace(/ id="[^"]*"/g, "").split(outputId).join("~"))
        const state = `${busy}|${dom}|${appliedSeq}`
        if (state === reported) return
        reported = state
        send(OUTPUT, ["RENDER_BUSY"], { id: outputId, busy, dom, seq: appliedSeq })
    }
    function contentHash(str: string): string {
        let h1 = 0xdeadbeef
        let h2 = 0x41c6ce57
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i)
            h1 = Math.imul(h1 ^ ch, 2654435761)
            h2 = Math.imul(h2 ^ ch, 1597334677)
        }
        return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`
    }
    const animationEvents = ["animationstart", "animationend", "animationcancel", "transitionrun", "transitionend", "transitioncancel"]
    onMount(() => {
        if ($currentWindow !== "output" || !rootEl) return
        const observer = new MutationObserver(queueCheck)
        observer.observe(rootEl, { subtree: true, childList: true, attributes: true, characterData: true })
        for (const ev of animationEvents) document.addEventListener(ev, queueCheck, true)
        window.api.receive(
            OUTPUT,
            (msg: any) => {
                if (typeof msg?.seq !== "number") return
                appliedSeq = msg.seq
                queueCheck()
            },
            "RENDER_SEQ"
        )
        queueCheck()
        return () => {
            observer.disconnect()
            window.api.removeListener(OUTPUT, "RENDER_SEQ")
            for (const ev of animationEvents) document.removeEventListener(ev, queueCheck, true)
        }
    })
    $: if (outputId && $currentWindow === "output") queueCheck()

    // Projeto Live: mapeamento de projetores (só na janela do projetor; as prévias mostram a imagem inteira)
    $: mapa = $currentWindow === "output" ? $outputs[outputId]?.mapa : null
    $: comMapa = mapaAtivo(mapa) && !$outputs[outputId]?.stageOutput
    $: regiao = mapa?.regiao && mapa.regiao.w > 0 && mapa.regiao.h > 0 ? mapa.regiao : { x: 0, y: 0, w: 1, h: 1 }
    $: vw = width / regiao.w
    $: vh = height / regiao.h
    $: gama = mapa?.gama || 2.2
    $: bordas = mapa?.bordas || {}
    $: pin = matrizCantos(width, height, mapa?.cantos || [])
</script>

<div
    bind:this={rootEl}
    class="fill context #output_window"
    style="flex-direction: {getStyleResolution(resolution, width, height, 'fit').includes('width') && !Object.values($outputs)[0]?.stageOutput ? 'row' : 'column'};"
    class:hideCursor={$special.hideCursor}
    on:mousemove={mousemoveOutput}
    bind:offsetWidth={width}
    bind:offsetHeight={height}
    on:dblclick={(e) => {
        if (e.target?.closest(".website") || e.target?.closest(".clickable")) return
        hideDisplay()
    }}
>
    {#if enableOutputMove}
        <div class="dragger">
            <p>Drag window</p>
        </div>
    {/if}

    {#if $presenting}
        <canvas class="presentCanvas" bind:this={presentCanvas}></canvas>
    {:else if $outputs[outputId]?.stageOutput}
        <StageLayout {outputId} stageId={$outputs[outputId].stageOutput} edit={false} />
    {:else if loaded && comMapa}
        <div class="plPin" style={pin ? `transform: ${pin};` : ""}>
            <div class="plCanvas" style="width: {vw}px; height: {vh}px; left: {-regiao.x * vw}px; top: {-regiao.y * vh}px; flex-direction: {getStyleResolution(resolution, vw, vh, 'fit').includes('width') ? 'row' : 'column'};">
                <Output {outputId} style={getStyleResolution(resolution, vw, vh, "fit")} />
                {#if mapa?.grade}
                    <svg class="plGrade" viewBox="0 0 {vw} {vh}" preserveAspectRatio="none">
                        {#each Array(17) as _, i}
                            <line x1={(i / 16) * vw} y1="0" x2={(i / 16) * vw} y2={vh} />
                        {/each}
                        {#each Array(10) as _, i}
                            <line x1="0" y1={(i / 9) * vh} x2={vw} y2={(i / 9) * vh} />
                        {/each}
                        <circle cx={vw / 2} cy={vh / 2} r={Math.min(vw, vh) * 0.45} />
                        <line class="diag" x1="0" y1="0" x2={vw} y2={vh} />
                        <line class="diag" x1={vw} y1="0" x2="0" y2={vh} />
                    </svg>
                {/if}
            </div>
            {#if bordas.esq}<div class="plFusao" style="left: 0; top: 0; bottom: 0; width: {bordas.esq * 100}%; background: {gradienteFusao('to right', gama)};" />{/if}
            {#if bordas.dir}<div class="plFusao" style="right: 0; top: 0; bottom: 0; width: {bordas.dir * 100}%; background: {gradienteFusao('to left', gama)};" />{/if}
            {#if bordas.cima}<div class="plFusao" style="left: 0; right: 0; top: 0; height: {bordas.cima * 100}%; background: {gradienteFusao('to bottom', gama)};" />{/if}
            {#if bordas.baixo}<div class="plFusao" style="left: 0; right: 0; bottom: 0; height: {bordas.baixo * 100}%; background: {gradienteFusao('to top', gama)};" />{/if}
        </div>
    {:else if loaded}
        <Output {outputId} style={getStyleResolution(resolution, width, height, "fit")} />
    {/if}

    <!-- black overlay for live preparation/changes -->
    {#if $livePrepare[outputId]}
        <div class="blackOverlay" transition:fade></div>
    {/if}

    <!-- preload CMGSans font -->
    {#if !loaded}<div class="fontPreload">.</div>{/if}
</div>

<style>
    .plPin {
        position: absolute;
        inset: 0;
        overflow: hidden;
        background: black;
        transform-origin: 0 0;
    }
    .plCanvas {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
    .plGrade {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10;
    }
    .plGrade line,
    .plGrade circle {
        stroke: #fff;
        stroke-width: 3;
        fill: none;
        vector-effect: non-scaling-stroke;
    }
    .plGrade .diag {
        stroke: #ff3b3b;
    }
    .plFusao {
        position: absolute;
        pointer-events: none;
        z-index: 20;
    }

    .presentCanvas {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background-color: black;
    }

    .dragger {
        -webkit-app-region: drag;
        position: absolute;
        top: 0;
        left: 0;
        height: 5vh;
        width: 100%;
        z-index: 10;

        display: flex;
        justify-content: center;
        align-items: center;

        background-color: rgb(255 255 255 / 0.2);
    }

    .fill {
        height: 100%;
        width: 100%;
        overflow: hidden;

        display: flex;
        /* enable this to see the actual output window cropped size */
        /* background: var(--primary-darkest); */
    }

    .fill.hideCursor {
        cursor: none;
    }

    .fontPreload {
        font-family: "CMGSans";
        position: absolute;
        opacity: 0;
    }

    .blackOverlay {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);

        width: 100%;
        height: 100%;

        background-color: black;
    }
</style>
