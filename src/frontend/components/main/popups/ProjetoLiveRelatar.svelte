<script lang="ts">
    // somun tela: "Relatar problema" (25/11) — texto, contato, print da janela (pode tirar) e o
    // registro técnico. Grava em Firestore › relatos (veja src/electron/projetoLive/relatar.ts).
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activePopup, popupData } from "../../../stores"
    import { plCultos } from "../../../utils/projetoLiveCultos"
    import { plRelatarRegistro } from "../../../utils/projetoLiveRelatar"

    let texto = ""
    let contato = ""
    // o print é tirado antes de abrir esta janela (SomunTop), para mostrar o problema e não ela
    let print: string = $popupData?.relatarPrint || ""
    let comPrint = true
    let enviando = false
    let erro = ""
    let enviado = false

    function enviar() {
        const t = texto.trim()
        if (!t) {
            erro = "Escreva o que aconteceu."
            return
        }
        enviando = true
        erro = ""
        const dados = { texto: t, contato: contato.trim(), conta: $plCultos.account?.email || "", print: comPrint ? print : "", registro: plRelatarRegistro() }
        requestMain(
            Main.PROJETO_LIVE_RELATAR_ENVIAR,
            dados,
            (result) => {
                enviando = false
                if (result?.ok) enviado = true
                else erro = `Não deu para enviar agora (${result?.detail || "sem resposta"}). Confira a internet e tente de novo.`
            },
            30000
        )
    }
</script>

<div class="relatar">
    {#if enviado}
        <p>Obrigado! Recebemos o seu relato.</p>
        <div class="linha"><button class="ok" on:click={() => activePopup.set(null)}>Fechar</button></div>
    {:else}
        <p class="dica">Conte o que aconteceu e o que você esperava. Vai junto um registro técnico (sem senhas).</p>
        <textarea bind:value={texto} placeholder="O que aconteceu?" autofocus />
        <input bind:value={contato} placeholder="WhatsApp ou e-mail para resposta (opcional)" />
        {#if print}
            <label class="print">
                <input type="checkbox" bind:checked={comPrint} />
                <img src={print} alt="Print da janela" class:apagado={!comPrint} />
                <span>Mandar o print da tela</span>
            </label>
        {/if}
        {#if erro}<p class="erro">{erro}</p>{/if}
        <div class="linha">
            <button on:click={() => activePopup.set(null)}>Cancelar</button>
            <button class="ok" disabled={enviando} on:click={enviar}>{enviando ? "Enviando…" : "Enviar"}</button>
        </div>
    {/if}
</div>

<style>
    .relatar {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 460px;
        max-width: 80vw;
    }
    p {
        margin: 0;
        line-height: 1.45;
    }
    .dica {
        color: #a8a8a8;
    }
    textarea,
    input:not([type="checkbox"]) {
        width: 100%;
        box-sizing: border-box;
        background: #1c1c1c;
        border: 1px solid #3a3a3a;
        border-radius: 8px;
        color: var(--text);
        font: inherit;
        padding: 10px;
    }
    textarea {
        min-height: 120px;
        resize: vertical;
    }
    textarea:focus,
    input:focus {
        outline: none;
        border-color: #a8a8a8;
    }
    .print {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        color: #a8a8a8;
    }
    .print img {
        width: 120px;
        border-radius: 4px;
        border: 1px solid #3a3a3a;
    }
    .print img.apagado {
        opacity: 0.3;
    }
    .erro {
        color: #e5483b;
    }
    .linha {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }
    button {
        border: 0;
        border-radius: 8px;
        min-height: 38px;
        padding: 0 16px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        background: #2a2a2a;
        color: var(--text);
    }
    button.ok {
        background: #ffffff;
        color: #141414;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
