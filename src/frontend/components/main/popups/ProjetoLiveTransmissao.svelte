<script lang="ts">
    // Projeto Live: janela "Transmissão" — o que vai para a live (OBS), deitado e em pé lado a lado.
    // A lógica fica em utils/projetoLiveTransmissao.ts.
    import { outputs, styles, templates } from "../../../stores"
    import { lerAjustes, mudar, voltarIgualAoTelao, type Ajustes, type Formato } from "../../../utils/projetoLiveTransmissao"
    import { imageExtensions } from "../../../values/extensions"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialFontDropdown from "../../inputs/MaterialFontDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import PreviewOutput from "../../output/preview/PreviewOutput.svelte"

    const formatos: { f: Formato; titulo: string; saida: string; largura: number }[] = [
        { f: "h", titulo: "Deitada (16:9)", saida: "pl_transmissao", largura: 420 },
        { f: "v", titulo: "Em pé (9:16)", saida: "pl_transmissao_vertical", largura: 190 }
    ]

    let ajustes: { [f: string]: Ajustes } = {}
    $: ajustes = ($styles, $templates, $outputs, { h: lerAjustes("h"), v: lerAjustes("v") })

    const posicoes = [
        { label: "No meio", value: "meio" },
        { label: "Embaixo (tipo legenda)", value: "embaixo" }
    ]
    const fundos = [
        { label: "Igual ao telão", value: "telao" },
        { label: "Uma cor", value: "cor" },
        { label: "Uma imagem", value: "imagem" },
        { label: "Transparente (letra por cima da câmera)", value: "transparente" }
    ]
    const enquadramentos = [
        { label: "Inteira, com fundo desfocado", value: "blur" },
        { label: "Preencher (corta as bordas)", value: "cover" },
        { label: "Inteira, com faixas", value: "contain" }
    ]
</script>

<div class="janela">
    {#each formatos as item}
        {@const a = ajustes[item.f]}
        <div class="coluna">
            <div class="topo">
                <h3>{item.titulo}</h3>
                {#if item.f === "h"}
                    {#if a.proprio}
                        <MaterialButton style="padding: 4px 8px;min-height: 0;" title="Apaga os ajustes próprios da transmissão deitada" on:click={voltarIgualAoTelao} white>Igual ao telão</MaterialButton>
                    {:else}
                        <span class="dica">igual ao telão</span>
                    {/if}
                {/if}
            </div>

            <div class="previa" style="width: {item.largura}px;">
                {#if a.existe}
                    <PreviewOutput outputId={item.saida} />
                {:else}
                    <p class="vazio">O OBS ainda não pediu esta saída.</p>
                {/if}
            </div>

            <div class="ajustes">
                <MaterialToggleSwitch label="Mostrar a letra" checked={a.letra} on:change={(e) => mudar(item.f, "letra", e.detail)} />
                {#if a.letra}
                    <MaterialFontDropdown label="Fonte" value={a.fonte} on:change={(e) => mudar(item.f, "fonte", e.detail)} />
                    <MaterialNumberInput label="Tamanho da letra" value={a.tamanho} min={10} max={500} step={5} on:change={(e) => mudar(item.f, "tamanho", e.detail)} />
                    <MaterialColorInput label="Cor da letra" value={a.cor} on:change={(e) => mudar(item.f, "cor", e.detail)} />
                    <MaterialDropdown label="Posição da letra" value={a.posicao} options={posicoes} on:change={(e) => mudar(item.f, "posicao", e.detail)} />
                {/if}

                <MaterialDropdown label="Fundo" value={a.fundo} options={fundos} on:change={(e) => mudar(item.f, "fundo", e.detail)} />
                {#if a.fundo === "cor"}
                    <MaterialColorInput label="Cor do fundo" value={a.corFundo} on:change={(e) => mudar(item.f, "corFundo", e.detail)} />
                {:else if a.fundo === "imagem"}
                    <MaterialFilePicker label="Imagem do fundo" value={a.imagemFundo} filter={{ name: "Imagem", extensions: imageExtensions }} on:change={(e) => mudar(item.f, "imagemFundo", e.detail)} allowEmpty />
                {/if}

                <MaterialDropdown label="Artes" value={a.enquadramento} options={enquadramentos} on:change={(e) => mudar(item.f, "enquadramento", e.detail)} />
                <MaterialToggleSwitch label="Mostrar os vídeos" checked={a.videos} on:change={(e) => mudar(item.f, "videos", e.detail)} />
            </div>
        </div>
    {/each}
</div>

<style>
    .janela {
        display: flex;
        gap: 24px;
        align-items: flex-start;
        min-width: 760px;
    }
    .coluna {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
        min-width: 0;
    }
    .coluna:first-child {
        flex: 1.6;
    }
    .topo {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 28px;
    }
    h3 {
        font-size: 1em;
        margin: 0;
    }
    .dica {
        font-size: 0.8em;
        opacity: 0.6;
    }
    .previa {
        max-width: 100%;
        align-self: center;
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        position: relative;
    }
    .vazio {
        padding: 20px 10px;
        font-size: 0.85em;
        opacity: 0.6;
        text-align: center;
    }
    .ajustes {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
</style>
