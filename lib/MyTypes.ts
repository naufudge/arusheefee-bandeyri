import { PvValues } from "@/lib/PvSchema"

export type PopupInfoType = {
    title: string,
    detail: string
}

export type SinglePVServerResponseType = {
    success: boolean,
    result: PvValues
}

export type MultiplePVServerResponseType = {
    success: boolean,
    result: PvValues[]
}