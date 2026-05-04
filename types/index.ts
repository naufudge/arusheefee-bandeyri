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

export type ExchangeRates = {
    USD: number,
    AUD: number,
    CAD: number,
    DKK: number,
    EUR: number,
    HKD: number,
    JPY: number,
    NOK: number,
    SGD: number,
    SAR: number,
    GBP: number,
    CHF: number,
    SEK: number,
    LKR: number,
    INR: number,
    THB: number,
    MYR: number,
    IDR: number,
    AED: number,
}

export type Staff = {
    _id: string,
    name: string,
    designation: string,
}