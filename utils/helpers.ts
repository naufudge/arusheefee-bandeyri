
/**
    * Returns input number in words (in Rufiyaa and Laari).
    * @param {number} num - The number that you want to convert.
    * @param {string} currency - The name of the currency.
*/
export function numberToWords(num: number, currency: string = "Rufiyaa") {
    
    const belowTwenty = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const thousands = ["", "Thousand", "Million", "Billion"];

    function helper(n: number): string {
        if (n === 0) return "";
        else if (n < 20) return belowTwenty[n] + " ";
        else if (n < 100) return tens[Math.floor(n / 10)] + " " + helper(n % 10);
        else if (n % 100 === 0) return belowTwenty[Math.floor(n / 100)] + " Hundred" + helper(n % 100);
        else return belowTwenty[Math.floor(n / 100)] + " Hundred and " + helper(n % 100);
    }

    if (num === 0) return "Zero";

    let integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    let words = "";
    let i = 0;

    while (integerPart > 0) {
        if (integerPart % 1000 !== 0) {
            words = helper(integerPart % 1000) + thousands[i] + " " + words;
        }
        integerPart = Math.floor(integerPart / 1000);
        i++;
    }

    const decimalWords = decimalPart > 0 ? helper(decimalPart) : "";

    return `${words.trim()} ${currency}` + (decimalWords ? ", " + `${decimalWords.trim()} Laari` : "");
}

export function formatNumberWithCommas(num: number | string, withDecimals: boolean = true) {
    const n = Number(num);
    if (!Number.isFinite(n)) return;

    return n.toLocaleString("en-US", {
        minimumFractionDigits: withDecimals ? 2 : 0,
        maximumFractionDigits: 2,
    });
}

/**
    * Removes duplicates from a list and returns it after that.
    * @param {string[]} original - The original list that you want to remove duplicates from.
*/
export function removeDuplicates(original: string[]) {
    const result: string[] = original.reduce((prev: string[], curr: string) => {
        if (!prev.includes(curr)) prev.push(curr);
        return prev;
    }, []);
    return result
}

export function capitalizeFirstLetter(word: string) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}