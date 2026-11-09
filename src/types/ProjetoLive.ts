// Projeto Live: OBS encontrados na rede pelo app de projeção (veja src/electron/projetoLive/obsLink.ts).

export type ProjetoLiveObsStatus = "found" | "connecting" | "waiting" | "connected" | "denied" | "busy" | "failed" | "offline"

export interface ProjetoLiveObs {
    id: string
    name: string
    host: string
    port: number
    status: ProjetoLiveObsStatus
    paired: boolean
    local: boolean
    // false quando o OBS ainda precisa ser reiniciado uma vez para liberar o controle
    control: boolean
}

export interface ProjetoLiveObsControl {
    host: string
    port: number
    password: string
}

// Para onde mandar o espelho do telão (fonte "Telão (projeção)" do OBS).
export interface ProjetoLiveObsMirror {
    host: string
    port: number
}
