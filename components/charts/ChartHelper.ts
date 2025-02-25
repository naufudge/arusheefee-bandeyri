/* eslint-disable */

import { capitalizeFirstLetter } from "@/lib/helpers";
import { ChartConfig } from "../ui/chart";

type ChartDataType = {
  collection: string;
  records: number;
  fill: string;
};

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

// function getFormattedDataset(data: Collection[], records: Record[]) {
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
