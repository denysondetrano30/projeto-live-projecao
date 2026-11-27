import type { Cropping, Resolution } from "./Settings"
import type { OutBackground, OutScene, OutSlide, OutTransition } from "./Show"

export interface Outputs {
    [key: string]: Output
}

export interface PLForma {
    id: string
    tipo: "ret" | "circ" | "img"
    src?: string // tipo "img": caminho do PNG (desenhado por cima, sem deformar)
    ar?: number // tipo "img": largura/altura da imagem em pixels
    x: number // frações da tela (0 a 1)
    y: number
    w: number
    h: number
    raio?: number // cantos: fração do menor lado (0 a 0.5)
    cantos?: number[] // cada canto separado [sup. esq., sup. dir., inf. dir., inf. esq.] (mesma escala do raio)
    cantosSoltos?: boolean // true = cada canto com seu valor (cadeado aberto)
}
export interface PLMascara {
    id: string
    nome: string
    formas: PLForma[]
    png?: string
    pngAjuste?: "contain" | "cover" | "fill" // padrão: contain (cabe sem esticar)
    camada?: "fundo" | "letra" | "tudo" // até onde corta (padrão: só o fundo; a letra fica por cima)
    cor?: string // cor de fora das formas (padrão: preto)
    opacidade?: number // 0 a 100 (padrão: 100)
}

export interface PLMapa {
    regiao?: { x: number; y: number; w: number; h: number } // pedaço da imagem que esta saída mostra (frações)
    bordas?: { esq?: number; dir?: number; cima?: number; baixo?: number } // largura da fusão (fração da janela)
    gama?: number // padrão 2.2
    cantos?: { x: number; y: number }[] // deslocamento de cada canto (sup.esq, sup.dir, inf.dir, inf.esq), fração da janela
    grade?: boolean // grade de teste para alinhar
    juncao?: boolean // criado pelo assistente de junção
    estiloAntes?: string // estilo que a saída usava antes da junção
}

export interface Output {
    id?: string
    hideFromPreview?: boolean
    stageOutput?: string
    enabled: boolean
    active: boolean
    name: string
    color: string
    bounds: { x: number; y: number; width: number; height: number }
    boundsLocked?: boolean
    cropping?: Cropping
    blending?: { left: number; right: number; rotate: number; opacity: number; centered: boolean; offset: number }
    screen: string | null
    alwaysOnTop?: boolean
    transparent?: boolean
    ndi?: boolean
    ndiData?: any
    omt?: boolean
    omtData?: any
    blackmagic?: boolean
    blackmagicData?: any
    webrtc?: boolean
    webrtcData?: { url?: string; token?: string; streaming?: boolean; startedAt?: number; fps?: string | number; bitrate?: string | number }
    rtmp?: boolean
    rtmpData?: RtmpData
    forcedResolution?: Resolution
    invisible?: boolean
    taskbar?: boolean
    style?: string
    mascaras?: PLMascara[] // Projeto Live: máscaras com nome (painel de LED)
    mascaraAtiva?: string
    mapa?: PLMapa // Projeto Live: mapeamento de projetores (região, fusão de bordas, 4 cantos)
    show?: any
    out?: OutData
}

export interface SyncedOutputs {
    [id: string]: string
}

// RTMP
export interface RtmpDestination {
    id: string
    url: string
    key: string
    enabled: boolean
    /** url is a file path: the encoded stream is recorded there instead of being sent */
    file?: boolean
}
export interface RtmpData {
    streaming?: boolean
    startedAt?: number
    fps?: string | number
    bitrate?: string | number
    rateControl?: "cbr" | "vbr"
    encoder?: string
    destinations?: RtmpDestination[]
    url?: string // deprecated, only used in v1.6.4
    key?: string // deprecated, only used in v1.6.4
}
export type RtmpDestinationState = "idle" | "connecting" | "live" | "reconnecting" | "error"
export interface RtmpStatus {
    /**
     * `restarts`/`lastIssue` persist for the whole stream rather than clearing on recovery: a
     * destination that keeps dropping and reconnecting reads as healthy from `state` alone.
     */
    [destinationId: string]: { state: RtmpDestinationState; error?: string; restarts?: number; lastIssue?: string }
}

export interface OutData {
    refresh?: number
    background?: null | OutBackground
    slide?: null | OutSlide
    effects?: string[]
    overlays?: string[]
    transition?: null | OutTransition
    scene?: null | OutScene
}

export interface Animation {
    actions: AnimationAction[]
    repeat?: boolean
    easing?: string
}

export interface AnimationAction {
    type: "change" | "set" | "wait"
    id?: "background" | "text" | "item"
    key?: string
    extension?: string
    value?: number
    duration: number
}
