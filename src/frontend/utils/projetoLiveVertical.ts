// Projeto Live: "Telão vertical" para a live em pé (18/11, pedido da pessoa).
//
// Quando o OBS usa o vertical (9:16), ele pede "NDIV on" e a Projeção cria uma segunda saída
// escondida, "Transmissão vertical (OBS)", 1080x1920, mandada por NDI com o nome
// "Projeto Live - Telão vertical". No OBS, onde a fonte "Telão (projeção)" estiver, a versão vertical
// da cena usa esse sinal sozinha.
//
// Decisões da pessoa:
// - arte 16:9 sem versão vertical: a arte inteira no meio e a própria arte ampliada e desfocada em
//   cima e embaixo (o "blur" do FreeShow, no estilo "Vertical (OBS)");
// - arte com versão vertical (botão direito na arte > "Versão vertical..."): o vertical mostra a outra
//   (guardada em media[caminho].plVertical);
// - letra e textos: reorganizados para a tela em pé pelo modelo "Letra vertical" (o estilo usa esse
//   modelo); a pessoa ajusta estilo e modelo na própria Projeção, como qualquer outro.

import { get } from "svelte/store"
import { OUTPUT } from "../../types/Channels"
import type { Styles } from "../../types/Settings"
import type { Template } from "../../types/Show"
import { clone } from "../components/helpers/array"
import { defaultOutput } from "../components/helpers/output"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import { receiveToMain, sendMain } from "../IPC/main"
import { media, outputs, styles, templates } from "../stores"
import { mediaExtensions } from "../values/extensions"
import { send } from "./request"

export const SAIDA_VERTICAL = "pl_transmissao_vertical"
export const NOME_NDI_VERTICAL = "Projeto Live - Telão vertical"
export const ESTILO_VERTICAL = "pl_vertical"
export const MODELO_VERTICAL = "pl_letra_vertical"

const LARGURA = 1080
const ALTURA = 1920

let quer = false

// O modelo da letra em pé: uma caixa de texto larga no meio da tela, letra grande que encolhe
// quando o verso é comprido. Só é criado se não existir (a pessoa pode mudar à vontade).
function garantirModelo() {
    if (get(templates)[MODELO_VERTICAL]) return
    const modelo: Template = {
        name: "Letra vertical",
        color: null,
        category: "song",
        settings: { resolution: { width: LARGURA, height: ALTURA } },
        items: [
            {
                style: "top:560px;left:60px;width:960px;height:800px;",
                align: "",
                textFit: "shrinkToFit",
                lines: [{ align: "", text: [{ value: "Letra vertical", style: "font-size: 90px;font-weight: bold;text-shadow: 3px 3px 8px rgb(0 0 0 / 80%);" }] }]
            }
        ]
    } as any
    templates.update((a) => {
        a[MODELO_VERTICAL] = modelo
        return a
    })
}

// O estilo da saída vertical: 1080x1920, arte com fundo desfocado, modelo da letra em pé.
// Criado uma vez; depois a pessoa ajusta em Configurações > Estilos.
function garantirEstilo() {
    garantirModelo()
    if (get(styles)[ESTILO_VERTICAL]) return
    const estilo: Styles = {
        name: "Vertical (OBS)",
        aspectRatio: { width: LARGURA, height: ALTURA },
        fit: "blur",
        blurAmount: 40,
        blurOpacity: 0.7,
        template: MODELO_VERTICAL,
        templateScripture: MODELO_VERTICAL
    }
    styles.update((a) => {
        a[ESTILO_VERTICAL] = estilo
        return a
    })
}

function arrumar() {
    const atual = get(outputs)[SAIDA_VERTICAL]
    if (!quer) {
        if (atual) {
            send(OUTPUT, ["REMOVE"], { id: SAIDA_VERTICAL })
            outputs.update((a) => {
                delete a[SAIDA_VERTICAL]
                return a
            })
        }
        return
    }
    garantirEstilo()
    if (atual && atual.bounds?.width === LARGURA && atual.bounds?.height === ALTURA && atual.style === ESTILO_VERTICAL && atual.ndi && atual.ndiData?.name === NOME_NDI_VERTICAL) return
    outputs.update((a) => {
        a[SAIDA_VERTICAL] = {
            ...clone(defaultOutput),
            ...(a[SAIDA_VERTICAL] || {}),
            name: "Transmissão vertical (OBS)",
            enabled: true,
            active: true,
            invisible: true,
            style: ESTILO_VERTICAL,
            bounds: { x: 0, y: 0, width: LARGURA, height: ALTURA },
            ndi: true,
            ndiData: { ...(a[SAIDA_VERTICAL]?.ndiData || {}), name: NOME_NDI_VERTICAL }
        } as any
        delete (a[SAIDA_VERTICAL] as any).mapa
        delete (a[SAIDA_VERTICAL] as any).mascaraAtiva
        delete (a[SAIDA_VERTICAL] as any).rtmp
        return a
    })
    send(OUTPUT, ["CREATE"], { ...get(outputs)[SAIDA_VERTICAL], id: SAIDA_VERTICAL })
}

// Chamado quando algum OBS pede (ou nenhum pede mais) o telão vertical.
export function setProjetoLiveNdiVertical(on: boolean) {
    quer = on
    try {
        arrumar()
    } catch (err) {
        console.warn("Projeto Live: telão vertical:", err)
    }
}

// A arte que o vertical mostra no lugar desta (ou a própria, se não tiver versão vertical).
export function caminhoParaSaida(outputId: string, caminho: string, _atualiza: any = null): string {
    if (outputId !== SAIDA_VERTICAL || !caminho) return caminho
    return (get(media)[caminho] as any)?.plVertical || caminho
}

export function versaoVertical(caminho: string): string {
    return (get(media)[caminho] as any)?.plVertical || ""
}

export function definirVersaoVertical(caminho: string, vertical: string) {
    if (!caminho) return
    media.update((a) => {
        const atual: any = a[caminho] || {}
        if (vertical) atual.plVertical = vertical
        else delete atual.plVertical
        a[caminho] = atual
        return a
    })
}

// A saída fica guardada nas configurações: se a Projeção abrir e nenhum OBS pedir o vertical, ela sai
// (para não ficar mandando NDI à toa).
setTimeout(() => {
    if (!quer && get(outputs)[SAIDA_VERTICAL]) setProjetoLiveNdiVertical(false)
}, 15000)

// Botão direito na arte > "Versão vertical...": escolhe o arquivo em pé; se já tiver, tira.
const PICK_ID = "pl_versao_vertical"
let escolhendoPara = ""
let ouvindo = false
export function alternarVersaoVertical(caminho: string) {
    if (!caminho) return
    if (versaoVertical(caminho)) {
        definirVersaoVertical(caminho, "")
        return
    }
    if (!ouvindo) {
        ouvindo = true
        receiveToMain(ToMain.OPEN_FILE2, (data: any) => {
            if (data?.id !== PICK_ID || data?.channel !== "MEDIA" || !data.files?.length || !escolhendoPara) return
            const escolhido = typeof data.files[0] === "string" ? data.files[0] : data.files[0]?.path
            if (escolhido && escolhido !== escolhendoPara) definirVersaoVertical(escolhendoPara, escolhido)
            escolhendoPara = ""
        })
    }
    escolhendoPara = caminho
    sendMain(Main.OPEN_FILE, { channel: "MEDIA", id: PICK_ID, filter: { name: "Arte vertical (9:16)", extensions: mediaExtensions }, multiple: false } as any)
}
