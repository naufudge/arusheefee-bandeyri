
/**
    * Returns input number in words (in Rufiyaa and Laari).
    * @param {number} num - The number that you want to convert.
*/
export function numberToWords(num: number) {
    
    const belowTwenty = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const thousands = ["", "Thousand", "Million", "Billion"];

    function helper(n: number): string {
        if (n === 0) return "";
        else if (n < 20) return belowTwenty[n] + " ";
        else if (n < 100) return tens[Math.floor(n / 10)] + " " + helper(n % 10);
        else return belowTwenty[Math.floor(n / 100)] + " Hundred and " + helper(n % 100);
    }

    if (num === 0) return "Zero";

    let integerPart = Math.floor(num);
    let decimalPart = Math.round((num - integerPart) * 100);

    let words = "";
    let i = 0;

    while (integerPart > 0) {
        if (integerPart % 1000 !== 0) {
            words = helper(integerPart % 1000) + thousands[i] + " " + words;
        }
        integerPart = Math.floor(integerPart / 1000);
        i++;
    }

    let decimalWords = decimalPart > 0 ? helper(decimalPart) : "";

    return `${words.trim()} Rufiyaa` + (decimalWords ? ", " + `${decimalWords.trim()} Laari` : "");
}

export function formatNumberWithCommas(num: number | string, withDecimals?: boolean) {
    const result = num.toString()

    const numWithDecimal = result.includes(".") && result.split(".")

    if (numWithDecimal) {
        let numArray = numWithDecimal[0].split("")

        switch (numArray.length) {
            case 1:
            case 2:
            case 3:
                return result
            case 4:
                numArray.splice(1, 0, ",")
                return numArray.join("") + "." + numWithDecimal[1]
            case 5:
                numArray.splice(2, 0, ",")
                return numArray.join("") + "." + numWithDecimal[1]
            case 6:
                numArray.splice(3, 0, ",")
                return numArray.join("") + "." + numWithDecimal[1]
            case 7:
                numArray.splice(3, 0, ",")
                numArray.splice(1, 0, ",")
                return numArray.join("") + "." + numWithDecimal[1]
            default:
                return
        }
    } else {
        let numArray = result.split("")
        switch (numArray.length) {
            case 1:
            case 2:
            case 3:
                return result
            case 4:
                numArray.splice(1, 0, ",")
                return numArray.join("") + (withDecimals ? ".00": "")
            case 5:
                numArray.splice(2, 0, ",")
                return numArray.join("") + (withDecimals ? ".00": "")
            case 6:
                numArray.splice(3, 0, ",")
                return numArray.join("") + (withDecimals ? ".00": "")
            case 7:
                numArray.splice(3, 0, ",")
                numArray.splice(1, 0, ",")
                return numArray.join("") + (withDecimals ? ".00": "")
            default:
                return
        }
    }
}