<script lang="ts">
    // Projeto Live: "Cultos do Diretor" — o que chegou do app do Diretor, se já está no computador,
    // versão nova para trocar e a conferência antes do culto (veja utils/projetoLiveCultos.ts).
    import { onMount } from "svelte"
    import { activePopup } from "../../../stores"
    import { ERROR_LABEL, isMedia, latestVersion, missingFiles, plCultos, plCultosLoad, plDownload, plDownloading, plForget, plMarkTested, plOpenVersion, plReceive, plShowProject, type PLCultoLocal } from "../../../utils/projetoLiveCultos"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    let pasting = false
    let pasteText = ""
    let message = ""
    let messageOk = true
    let busy = false
    // cultoId -> as três caixinhas da conferência
    let checks: { [cultoId: string]: boolean[] } = {}

    onMount(() => {
        plCultosLoad()
    })

    const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
    function when(culto: PLCultoLocal) {
        const p = (culto.data || "").split("-").map(Number)
        if (p.length !== 3) return ""
        const d = new Date(p[0], p[1] - 1, p[2])
        const hora = culto.hora ? " · " + culto.hora.replace(":00", "h").replace(":", "h") : ""
        return `${DIAS[d.getDay()]} ${String(p[2]).padStart(2, "0")}/${String(p[1]).padStart(2, "0")}${hora}`
    }

    $: list = Object.entries($plCultos.cultos).sort((a, b) => (b[1].data || "").localeCompare(a[1].data || ""))

    async function receive(text: string) {
        busy = true
        const result = await plReceive(text)
        busy = false
        message = result.message
        messageOk = result.ok
        if (result.ok) {
            pasting = false
            pasteText = ""
        }
    }

    // Tenta ler direto da área de transferência; se o sistema não deixar, abre o campo para colar.
    async function pasteFromDirector() {
        try {
            const text = await navigator.clipboard.readText()
            if (text && text.includes("projeto-live-culto")) return receive(text)
        } catch {
            // sem acesso: cola à mão
        }
        pasting = true
    }

    async function retry(cultoId: string, versao: number) {
        busy = true
        await plDownload(cultoId, versao)
        busy = false
    }

    function toggle(cultoId: string, index: number) {
        const current = checks[cultoId] || [false, false, false]
        current[index] = !current[index]
        checks[cultoId] = current
    }

    function open(cultoId: string) {
        plShowProject(cultoId)
        activePopup.set(null)
    }

    function switchTo(cultoId: string, versao: number) {
        plOpenVersion(cultoId, versao)
        checks[cultoId] = [false, false, false]
        activePopup.set(null)
    }
</script>

<div class="wrap">
    <div class="top">
        <p class="hint">Enquanto o app do Diretor não está ligado à internet, ele copia o culto em "Copiar para a Projeção". Cole aqui.</p>
        <MaterialButton variant="contained" icon="paste" title="Colar culto do Diretor" on:click={pasteFromDirector} disabled={busy}>Colar culto do Diretor</MaterialButton>
    </div>

    {#if pasting}
        <div class="paste">
            <textarea bind:value={pasteText} placeholder="Cole aqui o texto copiado no app do Diretor (Ctrl+V)" rows="4"></textarea>
            <MaterialButton variant="outlined" icon="check" title="Receber" on:click={() => receive(pasteText)} disabled={busy || !pasteText.trim()}>Receber</MaterialButton>
        </div>
    {/if}

    {#if message}
        <p class="message" class:bad={!messageOk}>{message}</p>
    {/if}

    {#if !list.length}
        <p class="empty">Nenhum culto recebido ainda.</p>
    {/if}

    {#each list as [cultoId, culto] (cultoId)}
        {@const latest = latestVersion(culto)}
        {@const inUse = culto.emUso}
        {@const shownVersion = inUse ?? latest}
        {@const missing = missingFiles(culto, shownVersion)}
        {@const entry = culto.versoes[shownVersion]}
        {@const mediaCount = entry ? entry.payload.itens.filter(isMedia).length : 0}
        {@const downloadingNow = entry ? entry.payload.itens.filter((i) => $plDownloading[i.id]).length : 0}
        {@const tested = !!culto.testado && culto.testado.versao === inUse}
        {@const box = checks[cultoId] || [false, false, false]}

        <div class="card" class:current={inUse !== null}>
            <div class="row">
                <p class="title">{culto.nome}{when(culto) ? " · " + when(culto) : ""}</p>
                <p class="faded">{inUse !== null ? "em uso: v" + inUse : "v" + latest}</p>
            </div>

            <div class="chips">
                <span class="chip ok">✓ Publicado</span>
                {#if downloadingNow}
                    <span class="chip wait">Baixando {mediaCount - missing.length + 1} de {mediaCount}…</span>
                {:else if missing.length}
                    <span class="chip warn">Baixado: {missing.length === 1 ? "falta 1 arquivo" : "faltam " + missing.length + " arquivos"}</span>
                {:else}
                    <span class="chip ok">✓ Baixado</span>
                {/if}
                {#if tested}
                    <span class="chip ok">✓ Testado</span>
                {:else}
                    <span class="chip todo">Testado: falta conferir</span>
                {/if}
                <span class="grow"></span>
                {#if !missing.length && !downloadingNow}
                    <span class="ready">Pronto para operar sem internet</span>
                {/if}
            </div>

            {#if missing.length && !downloadingNow}
                <div class="missing">
                    {#each missing as item}
                        {@const file = entry.arquivos[item.id]}
                        <p><b>{item.titulo || (item.tipo === "video" ? "Vídeo" : "Imagem")}</b>: {file?.error ? ERROR_LABEL[file.error] : "ainda não baixou"}</p>
                    {/each}
                    <MaterialButton variant="outlined" icon="refresh" title="Tentar de novo" on:click={() => retry(cultoId, shownVersion)} disabled={busy}>Tentar de novo</MaterialButton>
                </div>
            {/if}

            {#if inUse !== null && latest > inUse}
                <div class="newer">
                    <p>Versão nova disponível: <b>v{latest}</b>. A apresentação continua na v{inUse} até você trocar.</p>
                    <MaterialButton variant="contained" title="Trocar para v{latest}" on:click={() => switchTo(cultoId, latest)}>Trocar para v{latest}</MaterialButton>
                </div>
            {/if}

            {#if inUse !== null && !tested}
                <div class="checklist">
                    <p class="faded">Conferir antes do culto</p>
                    <label><input type="checkbox" checked={box[0]} on:change={() => toggle(cultoId, 0)} /> O telão mostra o primeiro item</label>
                    <label><input type="checkbox" checked={box[1]} on:change={() => toggle(cultoId, 1)} /> A letra aparece na Transmissão</label>
                    <label><input type="checkbox" checked={box[2]} on:change={() => toggle(cultoId, 2)} /> O som do primeiro vídeo sai</label>
                    <MaterialButton variant="outlined" icon="check" title="Marcar como testado" on:click={() => plMarkTested(cultoId)} disabled={!box.every(Boolean)}>Marcar como testado</MaterialButton>
                </div>
            {/if}

            <div class="actions">
                {#if inUse === null}
                    <MaterialButton variant="contained" icon="project" title="Montar o projeto" on:click={() => switchTo(cultoId, latest)}>Montar o projeto (v{latest})</MaterialButton>
                {:else}
                    <MaterialButton variant="outlined" icon="project" title="Abrir o projeto" on:click={() => open(cultoId)}>Abrir o projeto</MaterialButton>
                {/if}
                <span class="grow"></span>
                <MaterialButton title="Tirar da lista" icon="delete" on:click={() => plForget(cultoId)} />
            </div>
        </div>
    {/each}
</div>

<style>
    .wrap {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: min(720px, 80vw);
        padding-bottom: 10px;
    }
    .top {
        display: flex;
        align-items: center;
        gap: 14px;
    }
    .hint,
    .faded,
    .empty {
        opacity: 0.6;
        font-size: 0.85em;
    }
    .hint {
        flex: 1;
    }
    .empty {
        text-align: center;
        padding: 30px 0;
    }
    .paste {
        display: flex;
        gap: 10px;
        align-items: flex-start;
    }
    .paste textarea {
        flex: 1;
        background-color: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        padding: 8px;
        font-family: inherit;
        resize: vertical;
    }
    .message {
        font-size: 0.9em;
        color: #b8f0cd;
    }
    .message.bad {
        color: #ffb4ad;
    }
    .card {
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 10px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .card.current {
        border-color: var(--secondary);
    }
    .row,
    .chips,
    .actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }
    .title {
        font-weight: 600;
        flex: 1;
    }
    .grow {
        flex: 1;
    }
    .chip {
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 0.8em;
        border: 1px solid;
    }
    .chip.ok {
        border-color: #3ecf72;
        color: #b8f0cd;
    }
    .chip.warn {
        border-color: #e8a33d;
        color: #f2dfb0;
    }
    .chip.wait {
        border-color: #6b8ff0;
        color: #dbe6ff;
    }
    .chip.todo {
        border-style: dashed;
        border-color: #6b6b78;
        opacity: 0.85;
    }
    .ready {
        color: #b8f0cd;
        font-size: 0.85em;
        font-weight: 600;
    }
    .missing,
    .newer {
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 0.85em;
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: flex-start;
    }
    .missing {
        background-color: rgb(232 163 61 / 0.1);
        color: #f2dfb0;
    }
    .newer {
        background-color: rgb(232 163 61 / 0.15);
        color: #f2dfb0;
    }
    .checklist {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: flex-start;
        font-size: 0.9em;
    }
    .checklist label {
        display: flex;
        gap: 8px;
        align-items: center;
        cursor: pointer;
    }
</style>
