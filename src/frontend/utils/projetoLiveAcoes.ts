// Projeto Live (somun tela, 19/11): ações que faltavam.
// - "Tocar mídia" (pl_tocar_midia): toca um vídeo, imagem ou áudio escolhido numa lista (itens do culto
//   aberto e arquivos das pastas da aba Mídia). Vai para o telão; a live acompanha como sempre (decisão
//   dela: nada "só na live" — o operador do OBS decide o que vai para a transmissão).
// - Listas para a janela "Ação": itens do culto aberto (para "Iniciar item do projeto pelo nome").

import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { playAudio, playMedia } from "../components/actions/apiHelper"
import type { API_media } from "../components/actions/api"
import { getExtension, getFileName, getMediaType, removeExtension } from "../components/helpers/media"
import { activeProject, audioFolders, media, mediaFolders, projects, shows } from "../stores"
import { audioExtensions, mediaExtensions } from "../values/extensions"

export type OpcaoMidia = { value: string; label: string }

function nomeDoItem(item: any): string {
    if (item?.name) return item.name
    if ((item?.type || "show") === "show") return get(shows)[item?.id]?.name || ""
    return item?.id ? removeExtension(getFileName(item.id)) : ""
}

// "Iniciar item do projeto pelo nome": os nomes dos itens do culto aberto (sem as seções)
export function itensDoCulto(): OpcaoMidia[] {
    const itens = get(projects)[get(activeProject) || ""]?.shows || []
    const vistos = new Set<string>()
    const out: OpcaoMidia[] = []
    itens.forEach((item: any) => {
        if (item?.type === "section") return
        const nome = nomeDoItem(item)
        if (!nome || vistos.has(nome)) return
        vistos.add(nome)
        out.push({ value: nome, label: nome })
    })
    return out
}

// "Tocar mídia": primeiro os do culto aberto, depois os arquivos das pastas de Mídia e Áudio
export async function listaDeMidias(): Promise<OpcaoMidia[]> {
    const extensoes = [...mediaExtensions, ...audioExtensions]
    const vistos = new Set<string>()
    const out: OpcaoMidia[] = []

    const itens = get(projects)[get(activeProject) || ""]?.shows || []
    itens.forEach((item: any) => {
        const caminho = item?.id || ""
        if (!caminho || (item?.type || "show") === "show" || item.type === "section") return
        if (!extensoes.includes(getExtension(caminho).toLowerCase()) || vistos.has(caminho)) return
        vistos.add(caminho)
        out.push({ value: caminho, label: "Culto · " + removeExtension(item.name || getFileName(caminho)) })
    })

    const pastas = [...Object.values(get(mediaFolders)), ...Object.values(get(audioFolders))].map((p: any) => p?.path).filter(Boolean)
    if (pastas.length) {
        const arquivos: any = (await requestMain(Main.READ_FOLDER, { path: pastas })) || {}
        const daPasta: OpcaoMidia[] = []
        Object.entries(arquivos).forEach(([caminho, info]: [string, any]) => {
            if (info?.isFolder || vistos.has(caminho)) return
            if (!extensoes.includes(getExtension(caminho).toLowerCase())) return
            vistos.add(caminho)
            daPasta.push({ value: caminho, label: removeExtension(info?.name || getFileName(caminho)) })
        })
        daPasta.sort((a, b) => a.label.localeCompare(b.label))
        out.push(...daPasta)
    }
    return out
}

export function tocarMidia(data: API_media) {
    const caminho = data?.path
    if (!caminho) return
    const tipo = getMediaType(getExtension(caminho))
    if (tipo === "audio") return playAudio({ path: caminho })

    // vídeo: toca uma vez e com som, a não ser que a mídia tenha ajuste próprio
    const ajuste: any = get(media)[caminho] || {}
    playMedia({ path: caminho, data: { type: tipo, loop: ajuste.loop ?? false, muted: ajuste.muted ?? false } })
}
