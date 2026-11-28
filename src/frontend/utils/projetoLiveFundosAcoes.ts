// Projeto Live (somun tela, 28/11): pôr um fundo no telão pela aba "Fundos".
// Fundo = repete sem parar, mudo, atrás da letra (a letra nunca fecha). Vai marcado com plFundo: true,
// e é isso que o separa do vídeo "para assistir" da aba Mídia (que toca uma vez e some).
import { get } from "svelte/store"
import { media, styles } from "../stores"
import { getExtension, getMediaStyle, getMediaType } from "../components/helpers/media"
import { getAllActiveOutputs, setOutput } from "../components/helpers/output"
import { clearBackground } from "../components/output/clear"
import { ehFundoSomun, FUNDOS } from "./projetoLiveFundos"

export function idNoAr(bg: any) {
    return bg?.path || bg?.id || ""
}

export function porFundo(path: string, nome = "") {
    if (!path) return
    const ativas = getAllActiveOutputs()
    if (ativas.some((o) => idNoAr(o.out?.background) === path && o.out?.background?.plFundo)) {
        clearBackground()
        return
    }

    if (ehFundoSomun(path)) {
        const f = FUNDOS.find((x) => x.id === path)
        setOutput("background", { id: path, name: nome || f?.nome || "", type: "somun", plFundo: true })
        return
    }

    const type = getMediaType(getExtension(path))
    ativas.forEach((output) => {
        const estilo = getMediaStyle(get(media)[path], get(styles)[output.style || ""])
        setOutput("background", { path, name: nome, type, loop: true, muted: true, startAt: 0, ...estilo, videoType: "background", ignoreLayer: false, plFundo: true }, false, output.id)
    })
}
