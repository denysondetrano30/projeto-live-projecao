// Projeto Live: "Telão (projeção)" no OBS — espelho ao vivo do telão, com som.
//
// Quando o OBS tem a fonte "Telão (projeção)", ele avisa ("MIRROR <porta>") e a projeção passa a
// mandar a saída principal (vídeo H.264 + som) para o OBS usando o envio RTMP que o FreeShow já
// tem: um destino a mais, "tcp://<OBS>:<porta>" em FLV, onde a fonte do OBS fica escutando.
// Sem fonte no OBS (ou OBS desconectado), o destino sai e o envio para, se não houver outro.
//
// NDI (17/11): o OBS novo pede também "NDI on". Aí a mesma saída passa a mandar o telão por NDI
// com o nome "Projeto Live - Telão" (atraso bem menor que o FLV). O OBS usa o NDI quando ele chega e
// só pede o FLV ("MIRROR <porta>") se o NDI não aparecer; os dois podem ficar ligados juntos.

import { get } from "svelte/store"
import { OUTPUT } from "../../types/Channels"
import type { ProjetoLiveObsMirror } from "../../types/ProjetoLive"
import { createOutputAudioChannel } from "../audio/routing/audioRoutingInit"
import { checkFFmpeg, defaultOutput, updateOutputRtmpData } from "../components/helpers/output"
import { clone } from "../components/helpers/array"
import { ESTILO_JUNCAO } from "../components/drawer/mascaras/mapa"
import { audioRouting, outputs, styles } from "../stores"
import { newToast } from "./common"
import { send } from "./request"

const DEST_ID = "projeto-live-obs"
const MIRROR_BITRATE_KBPS = 12000
export const NOME_NDI = "Projeto Live - Telão"

// O OBS sempre recebe uma saída escondida só para a transmissão (17/11, pedido da pessoa), e não a
// Primária: sempre 1920x1080 (não depende do projetor nem do zoom do Windows), sem máscara, junção
// ou cantos, e a janela do telão não é recriada quando o OBS conecta. Mostra igual ao telão (mesmo
// estilo da Primária). Com junção de projetores usa o estilo da junção (imagem inteira, larga) em
// altura 1080; o OBS recorta o miolo 16:9 (decisão da pessoa: recortada, sem faixas).
export const SAIDA_TRANSMISSAO = "pl_transmissao"

function temJuncao() {
    return Object.values(get(outputs)).some((o) => o?.mapa?.juncao)
}

// a saída do telão (Primária): a primeira ligada e ativa que não é a nossa
function saidaDoTelao() {
    const lista = Object.entries(get(outputs)).filter(([id, o]) => id !== SAIDA_TRANSMISSAO && o?.enabled && !o?.stageOutput && !(o as any)?.invisible)
    return lista.find(([, o]) => o.active) || lista[0] || null
}

function estiloTransmissao() {
    if (temJuncao()) return ESTILO_JUNCAO
    // ajustes próprios da transmissão (janela "Transmissão"); sem eles, igual ao telão
    if (get(styles)["pl_transmissao_estilo"]) return "pl_transmissao_estilo"
    return saidaDoTelao()?.[1]?.style || ""
}

function tamanhoTransmissao() {
    if (!temJuncao()) return { x: 0, y: 0, width: 1920, height: 1080 }
    const ar = get(styles)[ESTILO_JUNCAO]?.aspectRatio
    const h = 1080
    const w = ar?.width && ar?.height ? Math.max(1920, Math.round((h * ar.width) / ar.height / 2) * 2) : 1920
    return { x: 0, y: 0, width: w, height: h }
}

// garante (ou tira) a saída escondida; devolve true se ela precisou ser criada/recriada agora
function arrumarSaidaTransmissao(): boolean {
    const atual = get(outputs)[SAIDA_TRANSMISSAO]
    if (!wanted && !ndiWanted) {
        if (atual) {
            send(OUTPUT, ["REMOVE"], { id: SAIDA_TRANSMISSAO })
            outputs.update((a) => {
                delete a[SAIDA_TRANSMISSAO]
                return a
            })
        }
        return false
    }
    const b = tamanhoTransmissao()
    const estilo = estiloTransmissao()
    if (atual && atual.bounds?.width === b.width && atual.bounds?.height === b.height && (atual.style || "") === estilo && !!atual.ndi === ndiWanted) return false
    outputs.update((a) => {
        a[SAIDA_TRANSMISSAO] = {
            ...clone(defaultOutput),
            ...(a[SAIDA_TRANSMISSAO] || {}),
            name: "Transmissão (OBS)",
            enabled: true,
            active: true,
            invisible: true,
            style: estilo,
            bounds: b,
            rtmp: true,
            ndi: ndiWanted,
            ndiData: { ...(a[SAIDA_TRANSMISSAO]?.ndiData || {}), name: NOME_NDI },
            plNdi: ndiWanted
        } as any
        delete (a[SAIDA_TRANSMISSAO] as any).mapa
        delete (a[SAIDA_TRANSMISSAO] as any).mascaraAtiva
        return a
    })
    send(OUTPUT, ["CREATE"], { ...get(outputs)[SAIDA_TRANSMISSAO], id: SAIDA_TRANSMISSAO })
    return true
}

// chamado quando a junção é aplicada, mudada ou desfeita
export function atualizarEspelhoJuncao() {
    if (!wanted && !ndiWanted) {
        arrumarSaidaTransmissao()
        return
    }
    run()
}

// Na versão anterior o envio ia pela própria Primária: tira dela o RTMP sem destino que ficou ligado
// (a janela volta a ser comum). Uma vez só por sessão.
let limpouPrimaria = false
function limparEnvioAntigo() {
    if (limpouPrimaria) return
    limpouPrimaria = true
    Object.entries(get(outputs)).forEach(([id, o]) => {
        if (id === SAIDA_TRANSMISSAO || !o?.rtmp) return
        const destinos = o.rtmpData?.destinations || []
        if (destinos.some((d) => d.enabled && d.url && d.id !== DEST_ID)) return
        if (destinos.some((d) => d.id === DEST_ID)) updateOutputRtmpData(id, "destinations", destinos.filter((d) => d.id !== DEST_ID))
        if (o.rtmpData?.streaming) updateOutputRtmpData(id, "streaming", false)
        outputs.update((a) => {
            if (a[id]) a[id].rtmp = false
            return a
        })
        const saida = get(outputs)[id]
        if (saida && saida.enabled !== false) send(OUTPUT, ["CREATE"], { ...saida, id })
    })
}

let wanted: ProjetoLiveObsMirror | null = null
let ndiWanted = false
let applying = false
let applyAgain = false
let ffmpegAsked = false

function destinationUrl(target: ProjetoLiveObsMirror) {
    return `tcp://${target.host}:${target.port}`
}

function removeFromAll() {
    Object.entries(get(outputs)).forEach(([outputId, output]) => {
        const destinations = output.rtmpData?.destinations || []
        if (!destinations.some((d) => d.id === DEST_ID)) return
        const rest = destinations.filter((d) => d.id !== DEST_ID)
        updateOutputRtmpData(outputId, "destinations", rest)
        // Só o OBS estava recebendo: para o envio.
        if (!rest.some((d) => d.enabled && d.url)) updateOutputRtmpData(outputId, "streaming", false)
    })
}

// Saídas onde fomos nós que ligamos o NDI (as que a pessoa ligou à mão não são mexidas).
function saidasComNossoNdi() {
    return Object.entries(get(outputs)).filter(([, o]) => o?.ndi && ((o as any).plNdi || o.ndiData?.name === NOME_NDI))
}

function recriarSaida(id: string) {
    const output = get(outputs)[id]
    if (output && output.enabled !== false) send(OUTPUT, ["CREATE"], { ...output, id })
}

function desligarNdi(exceto: string | null) {
    saidasComNossoNdi().forEach(([id]) => {
        if (id === exceto) return
        outputs.update((a) => {
            if (a[id]) {
                a[id].ndi = false
                delete (a[id] as any).plNdi
            }
            return a
        })
        recriarSaida(id)
    })
}

// Liga o NDI na saída do telão; devolve true se a janela precisou ser recriada.
function ligarNdi(outputId: string): boolean {
    desligarNdi(outputId)
    const output = get(outputs)[outputId]
    if (!output) return false
    if (output.ndi) {
        // já ligado (por nós ou à mão): garante o nome que o OBS procura
        if (output.ndiData?.name !== NOME_NDI) {
            outputs.update((a) => {
                a[outputId].ndiData = { ...(a[outputId].ndiData || {}), name: NOME_NDI }
                return a
            })
            recriarSaida(outputId)
            return true
        }
        return false
    }
    outputs.update((a) => {
        a[outputId].ndi = true
        a[outputId].ndiData = { ...(a[outputId].ndiData || {}), name: NOME_NDI }
        ;(a[outputId] as any).plNdi = true
        return a
    })
    recriarSaida(outputId)
    return true
}

async function apply() {
    const target = wanted
    const ndi = ndiWanted
    if (!target && !ndi) {
        removeFromAll()
        desligarNdi(null)
        saidaObs = null
        atualizarSomDoPc()
        return
    }
    if (!target) removeFromAll()

    const recriada = arrumarSaidaTransmissao()
    limparEnvioAntigo()
    const outputId = get(outputs)[SAIDA_TRANSMISSAO] ? SAIDA_TRANSMISSAO : null
    saidaObs = outputId || null
    atualizarSomDoPc()
    if (!outputId) return
    if (recriada) {
        await new Promise((resolve) => setTimeout(resolve, 2500))
        if (wanted !== target || ndiWanted !== ndi) return
    }

    if (ndi) {
        if (ligarNdi(outputId)) {
            await new Promise((resolve) => setTimeout(resolve, 2500))
            if (wanted !== target || ndiWanted !== ndi) return
        }
        // som do telão também no NDI
        createOutputAudioChannel(outputId)
    } else {
        desligarNdi(null)
    }
    if (!target) return

    // O envio usa o FFmpeg; o FreeShow pergunta antes de baixar (uma vez só).
    if (!ffmpegAsked) {
        ffmpegAsked = true
        if (!(await checkFFmpeg())) {
            newToast("O telão não vai para o OBS sem o FFmpeg")
            return
        }
    }
    if (wanted !== target || ndiWanted !== ndi) return

    // O destino do OBS só fica na saída principal.
    Object.entries(get(outputs)).forEach(([id, output]) => {
        if (id === outputId) return
        if ((output.rtmpData?.destinations || []).some((d) => d.id === DEST_ID)) {
            const rest = (output.rtmpData?.destinations || []).filter((d) => d.id !== DEST_ID)
            updateOutputRtmpData(id, "destinations", rest)
            if (!rest.some((d) => d.enabled && d.url)) updateOutputRtmpData(id, "streaming", false)
        }
    })

    let output = get(outputs)[outputId]
    if (!output) return

    // Liga o modo de envio da saída (a janela do telão é recriada uma vez só; depois fica ligado).
    if (!output.rtmp) {
        outputs.update((a) => {
            if (a[outputId]) a[outputId].rtmp = true
            return a
        })
        output = get(outputs)[outputId]
        if (output?.enabled !== false) {
            send(OUTPUT, ["CREATE"], { ...output, id: outputId })
            // espera a janela do telão ser recriada antes de ligar o envio
            await new Promise((resolve) => setTimeout(resolve, 2500))
            if (wanted !== target || ndiWanted !== ndi) return
        }
        output = get(outputs)[outputId]
    }

    // Som: a saída precisa de um canal próprio no roteamento de áudio (como as saídas de rede do
    // FreeShow), com o som do telão, da gaveta de áudio e das playlists. O alto-falante continua.
    createOutputAudioChannel(outputId)

    // Rede local aguenta bem mais que o padrão do FreeShow (4000 kbps, pensado para a internet):
    // o telão chega no OBS mais nítido. Só quando ninguém escolheu outro valor.
    if (!output?.rtmpData?.bitrate) updateOutputRtmpData(outputId, "bitrate", MIRROR_BITRATE_KBPS)

    const url = destinationUrl(target)
    const destinations = output?.rtmpData?.destinations || []
    const current = destinations.find((d) => d.id === DEST_ID)
    if (!current || current.url !== url || !current.enabled) {
        const others = destinations.filter((d) => d.id !== DEST_ID)
        updateOutputRtmpData(outputId, "destinations", [...others, { id: DEST_ID, url, key: "", enabled: true }])
    }
    if (!get(outputs)[outputId]?.rtmpData?.streaming) updateOutputRtmpData(outputId, "streaming", true)
}

async function run() {
    if (applying) {
        applyAgain = true
        return
    }
    applying = true
    try {
        do {
            applyAgain = false
            await apply()
        } while (applyAgain)
    } catch (err) {
        console.warn("Projeto Live: espelho do telão:", err)
    } finally {
        applying = false
    }
}

// Chamado quando o OBS pede (ou para de pedir) o espelho do telão.
export function setProjetoLiveMirror(target: ProjetoLiveObsMirror | null) {
    const same = (wanted && target && wanted.host === target.host && wanted.port === target.port) || (!wanted && !target)
    wanted = target
    if (same) return
    run()
}

// Chamado quando algum OBS pede (ou nenhum pede mais) o telão por NDI.
export function setProjetoLiveNdi(on: boolean) {
    if (ndiWanted === on) return
    ndiWanted = on
    run()
}

// Som de vídeos do YouTube/internet (17/11): o player embutido toca o som por conta própria e a
// Projeção não consegue misturá-lo. Só enquanto o telão mostra um desses vídeos, o canal da saída do
// OBS recebe também o "som do computador" (captura do Windows que o FreeShow já tem). Vai só para o
// OBS, nunca para o alto-falante; quando o vídeo sai, volta como estava.
let saidaObs: string | null = null
let somDoPc: { canal: string; desktopAntes: boolean } | null = null

function tocandoVideoDaInternet(id: string | null) {
    if (!id) return false
    const telao = saidaDoTelao()?.[1]
    return get(outputs)[id]?.out?.background?.type === "player" || telao?.out?.background?.type === "player"
}

function atualizarSomDoPc() {
    const quer = tocandoVideoDaInternet(saidaObs) ? `channel_${saidaObs}` : null
    if ((somDoPc?.canal || null) === quer) return
    const antes = somDoPc
    audioRouting.update((a) => {
        if (!a) return a
        let connections = a.connections || []
        let desktopAudioEnabled = a.desktopAudioEnabled
        if (antes) {
            connections = connections.filter((c) => !(c.from === "desktop_default" && c.to === antes.canal))
            desktopAudioEnabled = antes.desktopAntes
        }
        if (quer) {
            if (!antes) desktopAudioEnabled = !!a.desktopAudioEnabled
            connections = [...connections, { from: "desktop_default", to: quer }]
        }
        somDoPc = quer ? { canal: quer, desktopAntes: antes ? antes.desktopAntes : !!a.desktopAudioEnabled } : null
        return { ...a, connections, desktopAudioEnabled: quer ? true : desktopAudioEnabled }
    })
}

// null = ainda não olhou; "" = telão sem estilo (19/11: a 1ª troca, de "" para o estilo dos Padrões,
// era ignorada e a prévia "Indo para a live" ficava com o visual antigo)
let estiloVisto: string | null = null
outputs.subscribe(() => {
    if (saidaObs || somDoPc) atualizarSomDoPc()
    // a Primária trocou de estilo: a saída da transmissão acompanha
    if (wanted || ndiWanted) {
        const estilo = estiloTransmissao()
        if (estiloVisto !== null && estilo !== estiloVisto) setTimeout(() => run())
        estiloVisto = estilo
    }
})
