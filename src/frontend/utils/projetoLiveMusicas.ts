// Projeto Live: o banco de músicas da igreja, na conta (coleção "musicas" do Firestore).
//
// Com a conta conectada, a Projeção:
// - sobe a biblioteca de músicas (título, artista, letra em texto): na primeira vez tudo, depois só o
//   que mudou (cada música tem um "hash"); música apagada aqui fica marcada como apagada lá;
// - baixa as músicas que o diretor cadastrou no app do Diretor ("pendente") e cria a música na
//   biblioteca sozinha (decisão da pessoa, 14/11: entra sem aprovação).
// O app do Diretor busca nesse banco por título ou por trecho da letra.
//
// Roda ao abrir (depois de carregar a conta) e a cada 2 minutos. Sem internet, tenta de novo depois.

import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import type { Show } from "../../types/Show"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
import { convertText } from "../converters/txt"
import { requestMain } from "../IPC/main"
import { shows } from "../stores"
import { plCifraShow } from "./projetoLiveCifra"
import { plCultos, plCultosSave } from "./projetoLiveCultos"

const EVERY_MS = 2 * 60 * 1000
let timer: ReturnType<typeof setInterval> | null = null
let running = false

export function plMusicasStart() {
    if (timer) return
    timer = setInterval(plMusicasSync, EVERY_MS)
    setTimeout(plMusicasSync, 5000)
}

function state() {
    const current = get(plCultos)
    return current.musicas || { hashes: {}, docs: {} }
}

function remember(update: (bank: { hashes: { [id: string]: string }; docs: { [id: string]: string } }) => void) {
    plCultos.update((current) => {
        const bank = current.musicas || { hashes: {}, docs: {} }
        update(bank)
        current.musicas = bank
        return current
    })
    plCultosSave()
}

function keepRefresh(result: any) {
    if (!result?.refreshToken) return
    plCultos.update((current) => {
        if (current.account && current.account.refreshToken !== result.refreshToken) current.account.refreshToken = result.refreshToken
        return current
    })
}

export async function plMusicasSync() {
    const account = get(plCultos).account
    if (!account || running) return
    running = true
    try {
        await receive(account)
        await send(account)
    } catch (err) {
        console.warn("Projeto Live: banco de músicas", err)
    } finally {
        running = false
    }
}

/* ---- descer: músicas cadastradas pelo diretor ---- */

async function receive(account: { uid: string; refreshToken: string }) {
    const result = await requestMain(Main.PROJETO_LIVE_MUSICAS_PENDING, { uid: account.uid, refreshToken: account.refreshToken }, undefined, 30000)
    if (!result?.ok) return
    keepRefresh(result)

    const newShows: { id: string; show: Show }[] = []
    const done: { docId: string; fields: any }[] = []
    const all = get(shows)
    for (const musica of result.musicas as any[]) {
        const docs = state().docs
        const known = Object.entries(docs).find(([, docId]) => docId === musica.id)?.[0]
        const cifra = String(musica.cifra || "").trim()
        if (known && all[known]) {
            // Música que já existe: se o diretor mandou a cifra, ela ganha os acordes (mesmo nome).
            if (cifra) {
                const { show } = plCifraShow(all[known].name, cifra)
                show.name = all[known].name
                if (musica.artista) show.meta = { ...(show.meta || {}), artist: musica.artista }
                history({ id: "SHOWS", newData: { data: [{ id: known, show }], replace: true } })
            }
            done.push({ docId: musica.id, fields: { pendente: false, showId: known } })
            continue
        }
        const letra = String(musica.letra || "").trim()
        if (!letra && !cifra) {
            done.push({ docId: musica.id, fields: { pendente: false } })
            continue
        }
        const { id, show } = cifra ? plCifraShow(musica.titulo || "Música", cifra) : convertText({ name: musica.titulo || "Música", text: letra, noFormatting: true, returnData: true, open: false })
        show.name = checkName(show.name, id)
        if (musica.artista) show.meta = { ...(show.meta || {}), artist: musica.artista }
        newShows.push({ id, show })
        remember((bank) => {
            bank.docs[id] = musica.id
        })
        done.push({ docId: musica.id, fields: { pendente: false, showId: id } })
    }
    if (newShows.length) history({ id: "SHOWS", newData: { data: newShows } })
    if (done.length) {
        const answer = await requestMain(Main.PROJETO_LIVE_MUSICAS_UPLOAD, { uid: account.uid, refreshToken: get(plCultos).account?.refreshToken || account.refreshToken, songs: done }, undefined, 60000)
        keepRefresh(answer)
    }
}

/* ---- subir: a biblioteca da Projeção ---- */

async function send(account: { uid: string; refreshToken: string }) {
    const local = await requestMain(Main.PROJETO_LIVE_MUSICAS_LOCAL)
    if (!local?.ok) return
    const bank = state()
    const now = new Date().toISOString()
    const songs: { docId: string; fields: any }[] = []
    const hashes: { [showId: string]: string } = {}
    const docs: { [showId: string]: string } = {}

    for (const musica of local.musicas as any[]) {
        const docId = bank.docs[musica.showId] || `${account.uid}_${musica.showId}`
        docs[musica.showId] = docId
        hashes[musica.showId] = musica.hash
        if (bank.hashes[musica.showId] === musica.hash) continue
        const fields: any = { titulo: musica.titulo, letra: musica.letra, showId: musica.showId, pendente: false, apagada: false, atualizadoEm: now }
        if (musica.artista) fields.artista = musica.artista
        if (!bank.docs[musica.showId]) fields.origem = "projecao"
        songs.push({ docId, fields })
    }
    // Apagadas aqui: ficam marcadas lá (o app do Diretor não mostra).
    Object.keys(bank.hashes).forEach((showId) => {
        if (hashes[showId]) return
        songs.push({ docId: bank.docs[showId] || `${account.uid}_${showId}`, fields: { apagada: true, atualizadoEm: now } })
    })
    if (!songs.length) return

    const result = await requestMain(Main.PROJETO_LIVE_MUSICAS_UPLOAD, { uid: account.uid, refreshToken: get(plCultos).account?.refreshToken || account.refreshToken, songs }, undefined, 5 * 60 * 1000)
    if (!result?.ok) return
    keepRefresh(result)
    remember((saved) => {
        saved.hashes = hashes
        // Guarda o documento das músicas que existem, e o das recém-criadas pelo diretor (ainda sem arquivo).
        saved.docs = { ...Object.fromEntries(Object.entries(saved.docs).filter(([showId]) => get(shows)[showId])), ...docs }
    })
}
