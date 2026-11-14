// Projeto Live: lê a biblioteca de músicas da Projeção (os arquivos .show) para o banco de músicas da
// conta. Fica no processo principal porque a janela só carrega o conteúdo das músicas abertas.
//
// Para cada música: id, nome, artista (se tiver), a letra em texto (cada slide separado por linha em
// branco, na ordem do arranjo em uso, sem repetir o refrão) e um "hash" para saber se mudou.

import path from "path"
import { getDataFolderPath, parseShow, readFile } from "../utils/files"
import { getAllShows } from "../utils/shows"

export interface PLMusicaLocal {
    showId: string
    titulo: string
    artista: string
    letra: string
    hash: string
}

function hashText(text: string) {
    let hash = 5381
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
    return (hash >>> 0).toString(36)
}

function slideText(slide: any): string {
    const lines: string[] = []
    ;(slide?.items || []).forEach((item: any) => {
        ;(item?.lines || []).forEach((line: any) => {
            const text = (line?.text || []).map((part: any) => part?.value || "").join("")
            if (text.trim()) lines.push(text.trim())
        })
    })
    return lines.join("\n")
}

function showLyrics(show: any): string {
    const slides = show?.slides || {}
    const layoutId = show?.settings?.activeLayout
    const layout = (layoutId && show?.layouts?.[layoutId]) || Object.values(show?.layouts || {})[0]
    const order: string[] = (layout as any)?.slides?.map((ref: any) => ref?.id).filter(Boolean) || Object.keys(slides)

    const seen = new Set<string>()
    const parts: string[] = []
    order.forEach((id) => {
        if (seen.has(id) || !slides[id]) return
        seen.add(id)
        ;[id, ...(slides[id].children || [])].forEach((slideId: string) => {
            const text = slideText(slides[slideId])
            if (text) parts.push(text)
        })
    })
    return parts.join("\n\n")
}

export function plMusicasLocal(): { ok: true; musicas: PLMusicaLocal[] } {
    const folder = getDataFolderPath("shows")
    const musicas: PLMusicaLocal[] = []
    getAllShows().forEach((file) => {
        try {
            const parsed = parseShow(readFile(path.join(folder, file)) || "")
            if (!parsed) return
            const [showId, show] = parsed as [string, any]
            if (!showId || !show || show.private) return
            // Leituras da Bíblia, calendário e apresentações não são música.
            if (show.reference?.type || show.category === "presentation") return
            const letra = showLyrics(show)
            if (!letra) return
            const titulo = String(show.name || "").trim() || "Sem nome"
            const artista = String(show.meta?.artist || "").trim()
            musicas.push({ showId, titulo, artista, letra, hash: hashText(titulo + "\u0000" + artista + "\u0000" + letra) })
        } catch {
            // arquivo estragado: pula
        }
    })
    return { ok: true, musicas }
}
