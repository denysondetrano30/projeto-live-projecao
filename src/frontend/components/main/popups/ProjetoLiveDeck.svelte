<script lang="ts">
    // somun tela: "Deck no celular" (25/11) — o QR com o endereço e o código secreto do deck, que
    // controla o somun live (entradas, artes e volumes). Veja src/electron/projetoLive/deck.ts.
    import qrcode from "qrcode-generator"
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"

    let url = ""
    let conectado = false
    let qrImg = ""

    function mostrar(info: { url: string; conectado: boolean } | undefined) {
        if (!info) return
        url = info.url
        conectado = info.conectado
        const qr = qrcode(0, "M")
        qr.addData(url)
        qr.make()
        qrImg = qr.createImgTag(6, 12)
    }

    onMount(() => requestMain(Main.PROJETO_LIVE_DECK_INFO, undefined, mostrar))

    function trocar() {
        requestMain(Main.PROJETO_LIVE_DECK_NEWCODE, undefined, mostrar)
    }
</script>

<div class="deck">
    <p class="dica">Leia com a câmera do celular ou tablet (na mesma rede). Abre o deck no navegador, com o celular deitado.</p>
    {#if qrImg}
        <div class="qr">{@html qrImg}</div>
    {/if}
    {#if !conectado}
        <p class="aviso">O somun live não está conectado: o deck abre, mas só funciona quando ele conectar.</p>
    {/if}
    <div class="linha">
        <button on:click={trocar} title="Quem já leu o QR antigo sai do deck">Trocar código</button>
    </div>
</div>

<style>
    .deck {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        width: 380px;
        max-width: 80vw;
    }
    p {
        margin: 0;
        line-height: 1.45;
        text-align: center;
    }
    .dica,
    .aviso {
        color: #a8a8a8;
    }
    .qr {
        background: #ffffff;
        padding: 10px;
        border-radius: 10px;
        line-height: 0;
    }
    .linha {
        display: flex;
        justify-content: center;
    }
    button {
        border: 0;
        border-radius: 8px;
        min-height: 36px;
        padding: 0 16px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        background: #2a2a2a;
        color: var(--text);
    }
</style>
