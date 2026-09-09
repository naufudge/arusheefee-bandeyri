import { PvValues } from "@/schemas/PvSchema"

export type PopupInfoType = {
    title: string,
    detail: string
}

export type FilterType = {
    year: number | string,
    vendor: string,
    status: string,
}

export type SinglePVServerResponseType = {
    success: boolean,
    result: PvValues
}

export type MultiplePVServerResponseType = {
    success: boolean,
    result: PvValues[]
}

export type NormalServerResponseType = {
    success: boolean,
    result: string,
}

/**
 * MVR per one unit of each foreign currency, keyed by ISO code. A code is
 * absent when MMA publishes no series for it, so lookups must be guarded —
 * writing an undefined rate onto a PV is what made foreign-currency
 * vouchers silently fall back to a rate of 1.
 */
export type ExchangeRates = Record<string, number | undefined>

export type Staff = {
    _id: string,
    name: string,
    designation: string,
    dhivehiName?: string,
    dhivehiDesignation?: string,
    roleIds?: string[],
}