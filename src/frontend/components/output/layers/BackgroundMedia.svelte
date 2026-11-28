<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import type { Styles } from "../../../../types/Settings"
    import type { OutBackground, Transition } from "../../../../types/Show"
    import { media, outputs, playerVideos, special } from "../../../stores"
    import BmdStream from "../../drawer/live/BMDStream.svelte"
    import NdiStream from "../../drawer/live/NDIStream.svelte"
    import OmtStream from "../../drawer/live/OMTStream.svelte"
    import { getExtension, getMediaStyle, getMediaType } from "../../helpers/media"
    import Player from "../../system/Player.svelte"
    import Camera from "../Camera.svelte"
    import OutputTransition from "../transitions/OutputTransition.svelte"
    import Window from "../Window.svelte"
    import Media from "./Media.svelte"
    import { mediaLayersEnabled } from "./mediaLayers"
    import { mapaAtivo } from "../../drawer/mascaras/mapa"
    import { caminhoParaSaida } from "../../../utils/projetoLiveVertical"
    import { ajustesDe, temAjusteDeVideo } from "../../../utils/projetoLiveFundos"
    import SomunEfeitos from "./SomunEfeitos.svelte"
    import SomunFundo from "./SomunFundo.svelte"

    export let outputId = ""

    export let data: OutBackground
    export let transition: Transition
    export let fadingOut = false
    export let currentStyle: Styles | null = null
    export let animationStyle = ""
    export let mirror = false

    // Projeto Live: na saída do telão vertical, a versão vertical da arte (se tiver)
    $: id = caminhoParaSaida(outputId, data.path || data.id || "", $media)

    let type = "media"
    $: type = data.type || "media"
    $: if (type === "video" || type === "image") type = "media"

    // the worker can composite it only when the page changes nothing but its opacity
    $: fadeOnly = [transition?.in?.type || transition?.type, transition?.out?.type || transition?.type].every((t) => !t || t === "fade" || t === "none")
    // Projeto Live: com mapeamento ou máscara o vídeo precisa ser desenhado na própria página (o atalho
    // de composição por baixo ignora a região da junção e o recorte da máscara)
    $: plMapeada = !!outputId && (mapaAtivo($outputs[outputId]?.mapa) || !!$outputs[outputId]?.mascaraAtiva || !!$outputs[outputId]?.mapa?.juncao)
    // Projeto Live: o atalho também não respeita o enquadramento "fundo desfocado" nem a tela em pé (o
    // vídeo saía esticado no vertical, 18/11): nesses casos o vídeo é desenhado na própria página
    $: plSemAtalho = outputId === "pl_transmissao_vertical" || currentStyle?.fit === "blur" || (data as any)?.fit === "blur"
    // Projeto Live (28/11): fundo do somun e ajustes do painel "Fundo" (tingir/grão/intensidade são desenhados
    // na própria página, então o atalho de composição fica de fora quando há ajuste)
    $: plAjustado = temAjusteDeVideo(id, $media)
    $: plAjustes = ajustesDe(id, $media)
    $: layerable = $mediaLayersEnabled && !mirror && !!outputId && fadeOnly && !animationStyle && !$outputs[outputId]?.transparent && !plMapeada && !plSemAtalho && !plAjustado

    // Projeto Live: "vídeos" desligado na janela Transmissão: a saída da live não mostra vídeos
    $: plSemVideo = !!(currentStyle as any)?.plSemVideos && (data.type === "video" || data.type === "player" || getMediaType(getExtension(id)) === "video")

    let mediaStyle: MediaStyle = {}
    $: if (data && currentStyle) mediaStyle = getMediaStyle({ ...$media[id], ...data }, currentStyle)
    // Projeto Live: nas saídas da transmissão vale o enquadramento escolhido na janela "Transmissão" (o fundo
    // apresentado traz o enquadramento do telão; "preencher" esticava o vídeo 16:9 no vertical, 18/11)
    $: if (mediaStyle && (outputId === "pl_transmissao" || outputId === "pl_transmissao_vertical")) {
        const plFit = currentStyle?.fit || (outputId === "pl_transmissao_vertical" ? "blur" : "")
        if (plFit && mediaStyle.fit !== plFit) mediaStyle = { ...mediaStyle, fit: plFit }
    }
    // a velocidade do painel "Fundo" multiplica a do próprio vídeo
    $: plVelocidade = (plAjustes.velocidade ?? 100) / 100
    $: plMediaStyle = plVelocidade === 1 ? mediaStyle : { ...mediaStyle, speed: String(Math.max(0.1, (Number(mediaStyle.speed) || 1) * plVelocidade)) }
</script>

<OutputTransition {transition} inTransition={transition.in} outTransition={transition.out} on:outrostart={() => (fadingOut = true)}>
    {#if plSemVideo}
        <!-- vídeo escondido nesta saída -->
    {:else if type === "somun"}
        <SomunFundo {id} on:loaded />
    {:else if type === "media"}
        <!-- on:ended={videoEnded} -->
        <!-- sempre dentro do SomunEfeitos: o primeiro ajuste no painel não recomeça o vídeo -->
        <SomunEfeitos ajustes={plAjustes}>
            <Media {outputId} path={id} {data} {animationStyle} {mirror} mediaStyle={plMediaStyle} {fadingOut} {layerable} on:loaded />
        </SomunEfeitos>
    {:else if type === "screen"}
        <Window {id} class="media" style="width: 100%;height: 100%;" on:loaded />
    {:else if type === "ndi"}
        {#key id}
            <NdiStream screen={{ id, name: "" }} background outputBackground {mirror} {outputId} on:loaded />
        {/key}
    {:else if type === "omt"}
        {#key id}
            <OmtStream screen={{ id, name: "" }} background outputBackground {mirror} {outputId} on:loaded />
        {/key}
    {:else if type === "blackmagic"}
        <BmdStream screen={{ id, name: "" }} background outputBackground {mirror} {outputId} on:loaded />
    {:else if type === "camera"}
        <Camera {id} groupId={data.cameraGroup || ""} class="media" style="width: 100%;height: 100%;" on:loaded />
    {:else if type === "player"}
        <!-- prevent showing controls in output -->
        {#if $special.hideCursor || $playerVideos[id]?.type !== "youtube"}<div class="overlay" />{/if}
        <!-- on:ended={videoEnded} -->
        <Player {outputId} {id} {mirror} on:loaded />
    {/if}
</OutputTransition>

<style>
    /* div :global(.media) {
        max-width: 100%;
        max-height: 100%;
    } */

    .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: transparent;
        z-index: 1;
    }
</style>
