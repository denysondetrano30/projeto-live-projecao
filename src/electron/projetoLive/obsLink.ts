// Projeto Live: o app de projeção acha o OBS (Projeto Live) sozinho e se conecta a ele.
//
// O OBS se anuncia na rede como "_projetolive._tcp" e espera na porta 9020 (ou a próxima livre até
// 9029). No mesmo computador, também procuramos direto em 127.0.0.1.
// Conversa em linhas de texto (o lado do OBS está em plugins/projeto-live/projection-link.c no
// repositório projeto-live):
//
//   OBS      -> projeção: "PLP1 <desafio> <número do OBS>"
//   projeção -> OBS:      "HELLO <número desta projeção> <prova ou -> <nome deste computador>"
//   OBS      -> projeção: "PAIRED <chave>" (só na primeira vez, se a pessoa permitir no OBS),
//                         "OK <nome do OBS>", "WS <porta> <senha cifrada>" ou "WS off",
//                         "UNKNOWN" (chave esquecida no OBS), "DENIED", "BUSY"
//   projeção -> OBS:      "TEXT <texto em base64>" (texto do telão, para a legenda; "TEXT -" = sem texto)
//   os dois lados:        "PING" a cada 2 segundos; 6 segundos sem nada = caiu
//
// Com "WS", a projeção liga o controle do OBS que o FreeShow já tem (obs-websocket), sem digitar
// IP nem senha.

import Bonjour, { type Browser, type Service } from "bonjour-service"
import crypto from "crypto"
import { app } from "electron"
import fs from "fs"
import net from "net"
import os from "os"
import path from "path"
import { ToMain } from "../../types/IPC/ToMain"
import type { ProjetoLiveObs, ProjetoLiveObsStatus } from "../../types/ProjetoLive"
import { sendToMain } from "../IPC/main"
import { getMachineId } from "../utils/helpers"

const SERVICE_TYPE = "projetolive"
const LOCAL_PORTS = [9020, 9021, 9022]
const PING_MS = 2000
const SILENCE_MS = 6000
const RETRY_MS = 3000
const PROBE_MS = 5000
const BROWSE_REFRESH_MS = 10000

interface Candidate {
    id: string
    name: string
    host: string
    port: number
    local: boolean
}

interface Saved {
    obs: { [id: string]: { key: string; name: string } }
}

let bonjour: Bonjour | null = null
let browser: Browser | null = null
let timers: NodeJS.Timeout[] = []
let running = false

const candidates = new Map<string, Candidate>()
const links = new Map<string, Link>()
const statuses = new Map<string, ProjetoLiveObsStatus>()
const controlReady = new Map<string, boolean>()
let saved: Saved = { obs: {} }
// Texto que está no telão agora (vai para a legenda do OBS).
let screenText = ""

// ---------------------------------------------------------------------------
// Chaves guardadas (uma por OBS pareado)

function savedPath() {
    return path.join(app.getPath("userData"), "projeto-live-obs.json")
}

function loadSaved() {
    try {
        const data = JSON.parse(fs.readFileSync(savedPath(), "utf8"))
        if (data && typeof data.obs === "object") saved = { obs: data.obs }
    } catch {
        saved = { obs: {} }
    }
}

function writeSaved() {
    try {
        fs.writeFileSync(savedPath(), JSON.stringify(saved, null, 2))
    } catch (err) {
        console.warn("Projeto Live: não deu para salvar o pareamento:", err)
    }
}

// Número curto e fixo deste computador (o número de máquina do FreeShow tem 64 letras).
function deviceId() {
    return crypto
        .createHash("sha256")
        .update(getMachineId() || "projecao")
        .digest("hex")
        .slice(0, 32)
}

function deviceName() {
    return (os.hostname() || "Projeção").replace(".local", "")
}

// ---------------------------------------------------------------------------
// Senha do obs-websocket: XOR com SHA-256(chave + desafio + "ws" + número do bloco)

function decryptPassword(key: string, nonce: string, hex: string) {
    if (hex === "-") return ""
    const cipher = Buffer.from(hex, "hex")
    const plain = Buffer.alloc(cipher.length)
    for (let block = 0; block * 32 < cipher.length; block++) {
        const stream = crypto
            .createHash("sha256")
            .update(key)
            .update(nonce)
            .update("ws")
            .update(Buffer.from([block]))
            .digest()
        for (let i = 0; i < 32 && block * 32 + i < cipher.length; i++) {
            plain[block * 32 + i] = cipher[block * 32 + i] ^ stream[i]
        }
    }
    return plain.toString("utf8")
}

// ---------------------------------------------------------------------------
// Uma conexão com um OBS

class Link {
    private socket: net.Socket | null = null
    private buffer = ""
    private nonce = ""
    private lastRecv = Date.now()
    private pingTimer: NodeJS.Timeout | null = null
    private closed = false
    connected = false

    constructor(private target: Candidate) {}

    open() {
        const socket = net.connect({ host: this.target.host, port: this.target.port })
        this.socket = socket
        socket.setNoDelay(true)
        socket.setEncoding("utf8")
        socket.on("data", (chunk: string) => this.receive(chunk))
        socket.on("error", () => this.close())
        socket.on("close", () => this.close())
        setStatus(this.target.id, saved.obs[this.target.id] ? "connecting" : "waiting")
        this.pingTimer = setInterval(() => {
            if (Date.now() - this.lastRecv > SILENCE_MS) return this.close()
            this.send("PING")
        }, PING_MS)
    }

    close() {
        if (this.closed) return
        this.closed = true
        if (this.pingTimer) clearInterval(this.pingTimer)
        this.socket?.destroy()
        this.socket = null
        linkClosed(this.target.id, this, this.connected)
    }

    sendText() {
        if (!this.connected) return
        this.send("TEXT " + (screenText ? Buffer.from(screenText, "utf8").toString("base64") : "-"))
    }

    private send(line: string) {
        if (this.socket && !this.socket.destroyed) this.socket.write(line + "\n")
    }

    private receive(chunk: string) {
        this.lastRecv = Date.now()
        this.buffer += chunk
        if (this.buffer.length > 4096) return this.close()
        let newline = this.buffer.indexOf("\n")
        while (newline >= 0) {
            const line = this.buffer.slice(0, newline).replace(/\r$/, "")
            this.buffer = this.buffer.slice(newline + 1)
            this.handle(line)
            if (this.closed) return
            newline = this.buffer.indexOf("\n")
        }
    }

    private handle(line: string) {
        const [command, ...parts] = line.split(" ")
        const id = this.target.id

        if (command === "PLP1") {
            this.nonce = parts[0] || ""
            const key = saved.obs[id]?.key
            const proof = key ? crypto.createHmac("sha256", key).update(this.nonce).digest("hex") : "-"
            this.send(`HELLO ${deviceId()} ${proof} ${deviceName()}`)
        } else if (command === "PAIRED") {
            saved.obs[id] = { key: parts[0] || "", name: this.target.name }
            writeSaved()
        } else if (command === "OK") {
            this.connected = true
            const name = parts.join(" ").trim()
            if (name) {
                this.target.name = name
                if (saved.obs[id]) {
                    saved.obs[id].name = name
                    writeSaved()
                }
            }
            setStatus(id, "connected")
            this.sendText()
        } else if (command === "WS") {
            if (parts[0] === "off") {
                controlReady.set(id, false)
                publish()
                return
            }
            const key = saved.obs[id]?.key || ""
            const port = Number(parts[0])
            const password = decryptPassword(key, this.nonce, parts[1] || "-")
            controlReady.set(id, true)
            publish()
            sendToMain(ToMain.PROJETO_LIVE_OBS, { host: this.target.local ? "localhost" : this.target.host, port, password })
        } else if (command === "UNKNOWN") {
            // O OBS esqueceu este computador: na próxima vez pede permissão de novo.
            delete saved.obs[id]
            writeSaved()
            setStatus(id, "found")
            this.close()
        } else if (command === "DENIED") {
            setStatus(id, "denied")
            this.close()
        } else if (command === "BUSY") {
            setStatus(id, "busy")
            this.close()
        }
    }
}

function linkClosed(id: string, link: Link, wasConnected: boolean) {
    if (links.get(id) !== link) return
    links.delete(id)
    const status = statuses.get(id)
    if (status === "connected") setStatus(id, candidates.has(id) ? "found" : "offline")
    // Caiu antes de o OBS responder: mostra que não deu, para tentar de novo.
    else if (status === "connecting" || status === "waiting") setStatus(id, candidates.has(id) ? "failed" : "offline")
    if (!running) return
    // Pareado: tenta de novo sozinho.
    if (saved.obs[id] && (wasConnected || status === "connecting")) {
        const timer = setTimeout(() => autoConnect(id), RETRY_MS)
        timers.push(timer)
    }
}

// ---------------------------------------------------------------------------
// Lista para a tela

function setStatus(id: string, status: ProjetoLiveObsStatus) {
    statuses.set(id, status)
    publish()
}

export function projetoLiveList(): ProjetoLiveObs[] {
    const ids = new Set<string>([...candidates.keys(), ...Object.keys(saved.obs)])
    return [...ids].map((id) => {
        const found = candidates.get(id)
        return {
            id,
            name: found?.name || saved.obs[id]?.name || id,
            host: found?.host || "",
            port: found?.port || 0,
            status: statuses.get(id) || (found ? "found" : "offline"),
            paired: !!saved.obs[id],
            local: !!found?.local,
            control: controlReady.get(id) !== false
        }
    })
}

function publish() {
    sendToMain(ToMain.PROJETO_LIVE_STATUS, projetoLiveList())
}

// ---------------------------------------------------------------------------
// Conectar

function autoConnect(id: string) {
    if (!running || links.has(id) || !saved.obs[id]) return
    const target = candidates.get(id)
    if (!target) return
    const link = new Link(target)
    links.set(id, link)
    link.open()
}

// Botão "Conectar" (na primeira vez, o OBS pergunta "Permitir?").
export function projetoLiveConnect(id: string) {
    const target = candidates.get(id)
    if (!target || links.has(id)) return
    const link = new Link(target)
    links.set(id, link)
    link.open()
}

// Texto novo no telão: vai para todos os OBS conectados.
export function projetoLiveSetText(text: string) {
    // Limite para caber numa linha do OBS (o texto de um slide é bem menor que isso).
    screenText = (text || "").slice(0, 4000)
    links.forEach((link) => link.sendText())
}

// Botão "Esquecer": apaga a chave e desconecta.
export function projetoLiveForget(id: string) {
    delete saved.obs[id]
    writeSaved()
    links.get(id)?.close()
    if (!candidates.has(id)) statuses.delete(id)
    publish()
}

function addCandidate(candidate: Candidate) {
    const existing = candidates.get(candidate.id)
    // O mesmo OBS achado pela rede e direto no computador: fica o caminho direto.
    if (existing?.local && !candidate.local) return
    candidates.set(candidate.id, candidate)
    if (!statuses.has(candidate.id) || statuses.get(candidate.id) === "offline") statuses.set(candidate.id, "found")
    publish()
    autoConnect(candidate.id)
}

function removeCandidate(id: string, local: boolean) {
    const existing = candidates.get(id)
    if (!existing || existing.local !== local || links.has(id)) return
    candidates.delete(id)
    statuses.set(id, "offline")
    publish()
}

// ---------------------------------------------------------------------------
// Achar o OBS: pela rede (mDNS) e direto neste computador

function serviceHost(service: Service) {
    const ipv4 = (service.addresses || []).find((address) => address.includes("."))
    return ipv4 || service.referer?.address || service.host
}

function startBrowsing() {
    try {
        bonjour = new Bonjour({}, (err: any) => console.warn("Projeto Live: procura na rede:", err?.message || err))
        browser = bonjour.find({ type: SERVICE_TYPE, protocol: "tcp" })
        browser.on("up", (service: Service) => {
            const id = String(service.txt?.id || "")
            if (!id) return
            addCandidate({ id, name: service.name, host: serviceHost(service), port: service.port, local: false })
        })
        browser.on("down", (service: Service) => {
            const id = String(service.txt?.id || "")
            if (id) removeCandidate(id, false)
        })
        timers.push(setInterval(() => browser?.update(), BROWSE_REFRESH_MS))
    } catch (err) {
        console.warn("Projeto Live: não deu para procurar o OBS na rede:", err)
    }
}

// Lê só a primeira linha ("PLP1 <desafio> <id>") para saber qual OBS está nesta porta.
function probe(port: number): Promise<string | null> {
    return new Promise((resolve) => {
        const socket = net.connect({ host: "127.0.0.1", port })
        let text = ""
        const done = (id: string | null) => {
            socket.destroy()
            resolve(id)
        }
        socket.setTimeout(1500, () => done(null))
        socket.on("error", () => done(null))
        socket.on("data", (chunk) => {
            text += chunk.toString("utf8")
            const newline = text.indexOf("\n")
            if (newline < 0) return
            const [command, , id] = text.slice(0, newline).trim().split(" ")
            done(command === "PLP1" && id ? id : null)
        })
    })
}

async function probeLocal() {
    const seen = new Set<string>()
    for (const port of LOCAL_PORTS) {
        const already = [...candidates.values()].find((c) => c.local && c.port === port)
        if (already && links.has(already.id)) {
            seen.add(already.id)
            continue
        }
        const id = await probe(port)
        if (!running) return
        if (!id) continue
        seen.add(id)
        addCandidate({ id, name: saved.obs[id]?.name || deviceName(), host: "127.0.0.1", port, local: true })
    }
    for (const candidate of [...candidates.values()]) {
        if (candidate.local && !seen.has(candidate.id)) removeCandidate(candidate.id, true)
    }
}

// ---------------------------------------------------------------------------
// Começo e fim

export function startProjetoLiveLink() {
    if (running) return
    running = true
    loadSaved()
    startBrowsing()
    probeLocal().catch(() => null)
    timers.push(setInterval(() => probeLocal().catch(() => null), PROBE_MS))
}

export function stopProjetoLiveLink() {
    running = false
    timers.forEach((timer) => clearTimeout(timer))
    timers = []
    links.forEach((link) => link.close())
    links.clear()
    try {
        browser?.stop()
        bonjour?.destroy()
    } catch {
        // já fechado
    }
    browser = null
    bonjour = null
}
