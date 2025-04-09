/* eslint-disable */

import { capitalizeFirstLetter } from "@/lib/helpers";
import { ChartConfig } from "../ui/chart";

type ChartDataType = {
  collection: string;
  records: number;
  fill: string;
};

const GlResult = {
  "223005": 230000,
  "223001": 1367.9,
  "223002": 26283.91,
  "223008": 2285.99,
  "228007": 21923.98,
  "223004": 35684.06,
  "223016": 50000,
  "223003": 2931.31,
  "221004": 300,
  "223017": 1800
}

const colors = [
  "#A16AE8",
  "#4120A9",
  "#A1A9FE",
  "#6F2DA8",
  "#DA70D6",
  "#9966CC",
  "#F6D4D2",
  "#E6E6FA",
  "#DDA0DD",
  "#D8BFD8",
];

// function createChartConfig(data: Collection[]): ChartConfig {
//   return data.reduce(
//     (config, collection, index) => {
//       config[collection.name.toLowerCase()] = {
//         label: capitalizeFirstLetter(collection.name),
//         color: colors[index],
//       };
//       return config;
//     },
//     { records: { label: "Records" } } as ChartConfig
//   );
// }

// function getFormattedDataset(data: test, records: Record[]) {
//   return data.reduce<ChartDataType[]>((result, collection) => {
//     const filteredRecords = records.filter((record) => {
//       if (record.collectionId === collection.id) return record;
//     });

//     if (filteredRecords.length != 0) {
//       result.push({
//         collection: collection.name.toLowerCase(),
//         records: filteredRecords.length,
//         fill: `var(--color-${collection.name.toLowerCase()})`,
//       });
//     }
//     return result;
//   }, []);
// }

export function getFormattedDataset(data: {[key: string]: number}) {
  return Object.keys(data).map((GL) => ({
    code: GL,
    value: data[GL]
  }))
}



// export function getChartConfig(data: {[key: string]: number}) {
//   return {
//     data: Object.keys(data).map((key) => ({
//       code: key,
//       value: data[key],
//     })),
//     xKey: "code",
//     yKey: "value",
//     chartProps: {
//       margin: { top: 20, right: 30, left: 20, bottom: 30 },
//     },
//     xAxisProps: {
//       tickFormatter: (value: string) => value,
//     },
//     yAxisProps: {
//       tickFormatter: (value: number) => new Intl.NumberFormat().format(value),
//     },
//     tooltipFormatter: (value: number) => new Intl.NumberFormat().format(value),
//   } as ChartConfig;
// }

export function getChartConfig(data: { [key: string]: number }): ChartConfig {
  const chartConfig: ChartConfig = {};

  // Assuming you want to dynamically assign labels and colors based on the data
  Object.keys(data).forEach((key, index) => {
    chartConfig[key] = {
      label: key, // You can modify the label format as needed
      color: colors[index], // A random color for each category (you could use a fixed set of colors)
    };
  });

  return chartConfig;
}
