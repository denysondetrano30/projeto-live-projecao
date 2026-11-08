// Projeto Live: manda ao OBS o texto do slide que está no telão (legenda da live).
// Todo slide com texto vale: música, versículo, aviso. Telão sem texto = legenda some.
// O envio de verdade é feito por src/electron/projetoLive/obsLink.ts ("TEXT ...").

import { Main } from "../../types/IPC/Main"
import type { Item } from "../../types/Show"
import { getTextLines } from "../components/edit/scripts/textStyle"
import { getFirstActiveOutput } from "../components/helpers/output"
import { _show } from "../components/helpers/shows"
import { sendMain } from "../IPC/main"
import { outputs, showsCache } from "../stores"

let lastText: string | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function textOf(items: Item[] | undefined) {
    return getTextLines({ items: items || [] }).join("\n")
}

function currentText(): string {
    const slide = getFirstActiveOutput()?.out?.slide
    if (!slide) return ""
    // Versículos e textos rápidos vêm como itens temporários.
    if (slide.tempItems?.length) return textOf(slide.tempItems)
    if (!slide.id) return ""
    const layoutRef = _show(slide.id).layouts([slide.layout]).ref()[0] || []
    const slideId = layoutRef[slide.index ?? -1]?.id
    const current = _show(slide.id).get("slides")?.[slideId]
    return current ? textOf(current.items) : ""
}

function check() {
    timer = null
    let text = ""
    try {
        text = currentText().trim()
    } catch (err) {
        console.warn("Projeto Live: não deu para ler o texto do telão:", err)
    }
    if (text === lastText) return
    lastText = text
    sendMain(Main.PROJETO_LIVE_TEXT, { text })
}

function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(check, 50)
}

export function startProjetoLiveCaption() {
    outputs.subscribe(schedule)
    showsCache.subscribe(schedule)
}
