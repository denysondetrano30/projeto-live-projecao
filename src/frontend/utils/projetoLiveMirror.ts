// Projeto Live: "Telão (projeção)" no OBS — espelho ao vivo do telão, com som.
//
// Quando o OBS tem a fonte "Telão (projeção)", ele avisa ("MIRROR <porta>") e a projeção passa a
// mandar a saída principal (vídeo H.264 + som) para o OBS usando o envio RTMP que o FreeShow já
// tem: um destino a mais, "tcp://<OBS>:<porta>" em FLV, onde a fonte do OBS fica escutando.
// Sem fonte no OBS (ou OBS desconectado), o destino sai e o envio para, se não houver outro.

import { get } from "svelte/store"
import { OUTPUT } from "../../types/Channels"
import type { ProjetoLiveObsMirror } from "../../types/ProjetoLive"
import { createOutputAudioChannel } from "../audio/routing/audioRoutingInit"
import { checkFFmpeg, getFirstActiveOutput, updateOutputRtmpData } from "../components/helpers/output"
import { outputs } from "../stores"
import { newToast } from "./common"
import { send } from "./request"

const DEST_ID = "projeto-live-obs"
const MIRROR_BITRATE_KBPS = 12000

let wanted: ProjetoLiveObsMirror | null = null
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

async function apply() {
    const target = wanted
    if (!target) {
        removeFromAll()
        return
    }

    const outputId = getFirstActiveOutput()?.id
    if (!outputId) return

    // O envio usa o FFmpeg; o FreeShow pergunta antes de baixar (uma vez só).
    if (!ffmpegAsked) {
        ffmpegAsked = true
        if (!(await checkFFmpeg())) {
            newToast("O telão não vai para o OBS sem o FFmpeg")
            return
        }
    }
    if (wanted !== target) return

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
            if (wanted !== target) return
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
