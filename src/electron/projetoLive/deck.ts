// somun tela: o deck pelo celular (decidido com ela em 25/11).
//
// Um servidor pequeno (porta 5520) entrega a página do deck (public/deck/index.html) para celulares
// e tablets da rede. Só entra quem leu o QR: o endereço leva um código secreto (#código), conferido
// na conexão do socket.io; "Trocar código" derruba todo mundo. O deck controla o somun live
// (entradas, artes e volumes): os toques vão pela ligação com o live (obsLink.ts, "DECK <json>") e o
// estado volta ("DECKSTATE <json>") e é repassado a todos os celulares conectados.

import { app } from "electron"
import express from "express"
import fs from "fs"
import http from "http"
import os from "os"
import path from "path"
import crypto from "crypto"
import { Server } from "socket.io"
import { projetoLiveDeckConnected, projetoLiveDeckListen, projetoLiveDeckRefresh, projetoLiveDeckSend } from "./obsLink"

const PORT = 5520
let io: Server | null = null
let code = ""
let lastState: any = null

function codePath() {
    return path.join(app.getPath("userData"), "somun-deck.json")
}

function loadCode() {
    try {
        code = JSON.parse(fs.readFileSync(codePath(), "utf8")).codigo || ""
    } catch {
        code = ""
    }
    if (!code) newCode()
}

function newCode() {
    code = crypto.randomBytes(9).toString("base64url")
    try {
        fs.writeFileSync(codePath(), JSON.stringify({ codigo: code }))
    } catch (err) {
        console.warn("somun deck: não deu para salvar o código:", err)
    }
}

// O endereço deste computador na rede da igreja (IPv4 particular).
function lanAddress() {
    const nets = os.networkInterfaces()
    const found: string[] = []
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === "IPv4" && !net.internal) found.push(net.address)
        }
    }
    const privado = found.find((a) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a))
    return privado || found[0] || "127.0.0.1"
}

export function plDeckStart() {
    if (io) return
    loadCode()
    const web = express()
    const page = path.join(app.getAppPath(), "public", "deck", "index.html")
    web.get("/", (_req, res) => res.sendFile(page))
    web.use("/fonts", express.static(path.join(app.getAppPath(), "public", "fonts")))
    const server = http.createServer(web)
    io = new Server(server, { cors: { origin: false } })
    io.use((socket, next) => {
        const given = String((socket.handshake.auth as any)?.codigo || "")
        if (given && given === code) next()
        else next(new Error("codigo"))
    })
    io.on("connection", (socket) => {
        socket.emit("estado", { conectado: projetoLiveDeckConnected(), estado: lastState })
        projetoLiveDeckRefresh()
        socket.on("acao", (action: any) => {
            if (!action || typeof action !== "object") return
            const allowed = ["previa", "cortar", "arte", "vol", "mudo"]
            if (!allowed.includes(action.a)) return
            projetoLiveDeckSend({ a: action.a, id: String(action.id || "").slice(0, 200), v: Number(action.v) || 0, on: !!action.on })
        })
    })
    projetoLiveDeckListen((_id, state) => {
        lastState = state
        io?.emit("estado", { conectado: true, estado: state })
    })
    // Live caiu/voltou: avisa os celulares de vez em quando.
    let wasConnected = false
    setInterval(() => {
        const now = projetoLiveDeckConnected()
        if (now !== wasConnected) {
            wasConnected = now
            if (!now) lastState = null
            io?.emit("estado", { conectado: now, estado: lastState })
            if (now) projetoLiveDeckRefresh()
        }
    }, 2000)
    server.on("error", (err) => console.warn("somun deck: servidor não abriu:", err))
    server.listen(PORT)
}

export function plDeckInfo() {
    if (!io) plDeckStart()
    return { url: `http://${lanAddress()}:${PORT}/#${code}`, conectado: projetoLiveDeckConnected() }
}

export function plDeckNewCode() {
    newCode()
    // derruba quem estava com o código antigo
    io?.disconnectSockets(true)
    return plDeckInfo()
}
