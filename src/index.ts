/**
 * Copyright 2020 SnapStrat Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import _ from "lodash";
import BigNumber from "bignumber.js";

export enum AggregationTypes {
  min = "min",
  max = "max",
  count = "count",
  sum = "sum",
  average = "average",
  standardDeviation = "standardDeviation",
  weightedAverage = "weightedAverage",
}

export const AGG_METADATA_FIELD = "_aggregationMetadata";
const METADATA_MATCH_KEYS_FIELD = "matchKeys";
const METADATA_COUNT_FIELD = "count";
const METADATA_SOURCES_FIELD = "sources";
const METADATA_SUM_FIELD = "sum";
const METADATA_SUM_OF_SQUARES_FIELD = "sumOfSquares";
const METADATA_MIN_FIELD = "min";
const METADATA_MAX_FIELD = "max";
const METADATA_WEIGHTED_SUM_FIELD = "weightedSum";
const METADATA_TOTAL_WEIGHT_FIELD = "totalWeight";

interface IAggregationData {
  [METADATA_MATCH_KEYS_FIELD]: string[];
  [METADATA_COUNT_FIELD]: BigNumber;
  [METADATA_SOURCES_FIELD]: {
    [sourceField: string]: {
      [METADATA_SUM_FIELD]?: BigNumber;
      [METADATA_SUM_OF_SQUARES_FIELD]?: BigNumber;
      [METADATA_MIN_FIELD]?: BigNumber;
      [METADATA_MAX_FIELD]?: BigNumber;
      [METADATA_WEIGHTED_SUM_FIELD]?: BigNumber;
      [METADATA_TOTAL_WEIGHT_FIELD]?: BigNumber;
    };
  };
}

// Functions to calculate the aggregation values from the aggregation metadata
const aggregationFunctions: {
  [key in AggregationTypes]: ({
    aggregationData,
    sourceField,
    weightField,
  }: {
    aggregationData: IAggregationData;
    sourceField?: string;
    weightField?: string;
  }) => number;
} = {
  [AggregationTypes.min]: ({ aggregationData, sourceField }) =>
    aggregationData[METADATA_SOURCES_FIELD][sourceField][
      METADATA_MIN_FIELD
    ].toNumber(),
  [AggregationTypes.max]: ({ aggregationData, sourceField }) =>
    aggregationData[METADATA_SOURCES_FIELD][sourceField][
      METADATA_MAX_FIELD
    ].toNumber(),
  [AggregationTypes.sum]: ({ aggregationData, sourceField }) =>
    aggregationData[METADATA_SOURCES_FIELD][sourceField][
      METADATA_SUM_FIELD
    ].toNumber(),
  [AggregationTypes.count]: ({ aggregationData }) =>
    aggregationData[METADATA_COUNT_FIELD].toNumber(),
  [AggregationTypes.average]: ({ aggregationData, sourceField }) =>
    aggregationData[METADATA_SOURCES_FIELD][sourceField][
      METADATA_SUM_FIELD
    ].div(aggregationData[METADATA_COUNT_FIELD]).toNumber(),
  [AggregationTypes.standardDeviation]: ({ aggregationData, sourceField }) => {
    const count: BigNumber = aggregationData[METADATA_COUNT_FIELD];
    const average: BigNumber = aggregationData[METADATA_SOURCES_FIELD][
      sourceField
    ][METADATA_SUM_FIELD].div(count);
    const variance: BigNumber = aggregationData[METADATA_SOURCES_FIELD][
      sourceField
    ][METADATA_SUM_OF_SQUARES_FIELD].div(count).minus(average.pow(2));

    return variance.sqrt().toNumber();
  },
  [AggregationTypes.weightedAverage]: ({
    aggregationData,
    sourceField,
    weightField,
  }) => {
    const metadataKey = getWeightedAverageMetadataKey({
      sourceField,
      weightField,
    });

    return aggregationData[METADATA_SOURCES_FIELD][metadataKey][
      METADATA_WEIGHTED_SUM_FIELD
    ].div(
      aggregationData[METADATA_SOURCES_FIELD][metadataKey][
        METADATA_TOTAL_WEIGHT_FIELD
      ]
    ).toNumber();
  },
};

interface IAggregationField {
  method: AggregationTypes;
  sourceField?: string;
  weightField?: string;
}

type BucketEndpoints = number[];

interface IBuckets {
  [bucketKey: string]: BucketEndpoints;
}

interface IAggregationParams {
  records: any[];
  matchKeys?: string[];
  buckets?: IBuckets;
  fields: {
    [outputField: string]: IAggregationField;
  };
  noAggregateMetadata?: boolean;
  sortBy?: string[];
}

/**
 * Aggregates records
 * @param options
 * @param options.records - The records to aggregate. These can include records which are the output of a previous
 *                          aggregation (this uses the aggregation metadata attached to each aggregated record).
 *                          F([a, b, c, d]) === F([F([a, b]), c, d]) === F([F([a, b]), F([c, d])])
 * @param options.matchKeys - The fields to aggregate on. Nested fields can be accessed using path notation.
 *                            Ex "a[0].b.c"
 *
 * @param options.fields
 * @param options.fields.<outputFieldName> - The output field returned on the aggregated records.
 *                                           Nested fields are allowed using path notation. Ex "a[0].b.c"
 * @param options.fields.<outputFieldName>.method - The method of aggregation: either "sum", "min", "max", "average",
 *                                                  "standardDeviation", "weightedAverage", or "count"
 * @param options.fields.<outputFieldName>.sourceField - The field on the input records which the aggregation method
 *                                                       acts on. Not needed for the "count" method.
 *                                                       Nested fields can be accessed using path notation. Ex "a[0].b.c"
 * @param options.fields.<outputFieldName>.weightField - Only used for "weightedAverage" method. The field on the input
 *                                                       records which is the coefficient or weight for the weighted average.
 *                                                       Nested fields can be accessed using path notation. Ex "a[0].b.c"
 *
 * @param options.buckets
 * @param options.buckets.<bucketFieldName> - An array of breakpoints defining the bucket ranges.
 *                                            The bucketFieldName must be one of the match keys.
 *                                            If a value is on a breakpoint it is put in the lower bucket.
 *
 * @param options.noAggregateMetadata - If true, aggregation metadata will not be output on aggregated records.
 *                                  This is not recommended since the aggregated records cannot be augmented with new
 *                                  records if there is no aggregation metadata present.
 * @param options.sortBy - An array of fields to sort the output by.
 *
 * @returns object
 * @returns object.aggregatedRecords - The aggregated records
 * @returns object.totals - Totals of all records
 */
export function aggregate({
  records,
  matchKeys = [],
  buckets,
  fields,
  noAggregateMetadata = false,
  sortBy,
}: IAggregationParams): { aggregatedRecords: any[]; totals: any } {
  const aggregatedRecords = aggregateInternal({
    records,
    matchKeys,
    buckets,
    fields,
    sortBy,
  });
  const [totals] = aggregateInternal({ records, fields, sortBy });

  if (noAggregateMetadata) {
    aggregatedRecords.forEach((record) => {
      delete record[AGG_METADATA_FIELD];
    });

    delete totals[AGG_METADATA_FIELD];
  }

  return {
    aggregatedRecords,
    totals,
  };
}

function aggregateInternal({
  records,
  matchKeys = [],
  buckets,
  fields,
  noAggregateMetadata = false,
  sortBy,
}: IAggregationParams): any[] {
  const recordsHash: {
    [key: string]: {
      _aggregationMetadata: IAggregationData;
      [key: string]: any;
    };
  } = {};

  for (const record of records) {
    let isAggregatedRecord: boolean;

    if (record[AGG_METADATA_FIELD]) {
      if (
        !isSubset(
          matchKeys,
          record[AGG_METADATA_FIELD][METADATA_MATCH_KEYS_FIELD]
        )
      ) {
        isAggregatedRecord = false;

        console.log(
          "!!! Warning !!! Record was aggregated using different match keys which does not include the current match keys. " +
            "This record will be treated as a single record and the existing aggregation metadata will not be propagated.\n" +
            `Match keys on record: ${record[AGG_METADATA_FIELD][METADATA_MATCH_KEYS_FIELD]}\n` +
            `Current match keys: ${matchKeys}\n` +
            `Record: ${JSON.stringify(record)}`
        );
      } else {
        isAggregatedRecord = true;
      }
    }

    const standardSourceFields: string[] = _.uniq(
      Object.values(fields)
        .filter(({ method }) => method !== AggregationTypes.weightedAverage)
        .map(({ sourceField }) => sourceField)
        .filter((sourceField) => exists(sourceField))
    );

    const weightedAvgFields: IAggregationField[] = _.uniqBy(
      Object.values(fields).filter(
        ({ method }) => method === AggregationTypes.weightedAverage
      ),
      ({ sourceField, weightField }) =>
        getWeightedAverageMetadataKey({ sourceField, weightField })
    );

    if (record[AGG_METADATA_FIELD]) {
      standardSourceFields.forEach((sourceField) => {
        if (!record[AGG_METADATA_FIELD][METADATA_SOURCES_FIELD][sourceField]) {
          isAggregatedRecord = false;

          console.log(
            `!!! Warning !!! Source field aggregation metadata is not present on this record for field ${sourceField}. ` +
              "This is probably because the previous aggregation did not use this field.\n" +
              "This record will be treated as a single record and the existing aggregation metadata will not be propagated.\n" +
              `Record: ${JSON.stringify(record)}`
          );
        }
      });

      weightedAvgFields.forEach(({ sourceField, weightField }) => {
        if (!record[AGG_METADATA_FIELD][METADATA_SOURCES_FIELD][sourceField]) {
          isAggregatedRecord = false;

          console.log(
            "!!! Warning !!! Weighted average aggregation metadata is not present on this record for " +
              `source field ${sourceField} and weight field ${weightField}. ` +
              "This is probably because the previous aggregation did include a weighted average on these fields.\n" +
              "This record will be treated as a single record and the existing aggregation metadata will not be propagated.\n" +
              `Record: ${JSON.stringify(record)}`
          );
        }
      });
    }

    const hashKey = matchKeys
      .map((matchKey) =>
        getFieldHashKey({
          record,
          matchKey,
          bucketEndpoints: buckets?.[matchKey],
        })
      )
      .join("");

    if (!recordsHash[hashKey]) {
      recordsHash[hashKey] = {
        [AGG_METADATA_FIELD]: {
          [METADATA_COUNT_FIELD]: new BigNumber(0),
          [METADATA_MATCH_KEYS_FIELD]: matchKeys,
          [METADATA_SOURCES_FIELD]: {},
        },
      };

      for (const matchKey of matchKeys) {
        _.set(
          recordsHash[hashKey],
          matchKey,
          getFieldHashKey({
            record,
            matchKey,
            bucketEndpoints: buckets?.[matchKey],
          })
        );
      }
    }

    recordsHash[hashKey][AGG_METADATA_FIELD][
      METADATA_COUNT_FIELD
    ] = recordsHash[hashKey][AGG_METADATA_FIELD][METADATA_COUNT_FIELD].plus(
      isAggregatedRecord ? record[AGG_METADATA_FIELD][METADATA_COUNT_FIELD] : 1
    );

    standardSourceFields.forEach((sourceField) => {
      if (
        !recordsHash[hashKey][AGG_METADATA_FIELD][METADATA_SOURCES_FIELD][
          sourceField
        ]
      ) {
        recordsHash[hashKey][AGG_METADATA_FIELD][METADATA_SOURCES_FIELD][
          sourceField
        ] = {
          [METADATA_SUM_FIELD]: new BigNumber(0),
          [METADATA_SUM_OF_SQUARES_FIELD]: new BigNumber(0),
          [METADATA_MIN_FIELD]: new BigNumber(Infinity),
          [METADATA_MAX_FIELD]: new BigNumber(-Infinity),
        };
      }

      const newValue = _.get(record, sourceField);
      const metadataInHash =
        recordsHash[hashKey][AGG_METADATA_FIELD][METADATA_SOURCES_FIELD][
          sourceField
        ];
      const metadataOnRecord =
        record[AGG_METADATA_FIELD]?.[METADATA_SOURCES_FIELD][sourceField];

      metadataInHash[METADATA_SUM_FIELD] = metadataInHash[
        METADATA_SUM_FIELD
      ].plus(
        isAggregatedRecord ? metadataOnRecord[METADATA_SUM_FIELD] : newValue
      );

      metadataInHash[METADATA_SUM_OF_SQUARES_FIELD] = metadataInHash[
        METADATA_SUM_OF_SQUARES_FIELD
      ].plus(
        isAggregatedRecord
          ? metadataOnRecord[METADATA_SUM_OF_SQUARES_FIELD]
          : new BigNumber(newValue).pow(2)
      );

      metadataInHash[METADATA_MIN_FIELD] = BigNumber.min(
        metadataInHash[METADATA_MIN_FIELD],
        isAggregatedRecord ? metadataOnRecord[METADATA_MIN_FIELD] : newValue
      );

      metadataInHash[METADATA_MAX_FIELD] = BigNumber.max(
        metadataInHash[METADATA_MAX_FIELD],
        isAggregatedRecord ? metadataOnRecord[METADATA_MAX_FIELD] : newValue
      );
    });

    weightedAvgFields.forEach(({ sourceField, weightField }) => {
      if (!exists(weightField)) {
        throw new Error(
          '"weightedAverage" aggregations must specify a "weightField"'
        );
      }

      const sourceValue = _.get(record, sourceField);
      const weightValue = _.get(record, weightField);

      const metadataKey = getWeightedAverageMetadataKey({
        sourceField,
        weightField,
      });

      if (
        !recordsHash[hashKey][AGG_METADATA_FIELD][METADATA_SOURCES_FIELD][
          metadataKey
        ]
      ) {
        recordsHash[hashKey][AGG_METADATA_FIELD][METADATA_SOURCES_FIELD][
          metadataKey
        ] = {
          [METADATA_TOTAL_WEIGHT_FIELD]: new BigNumber(0),
          [METADATA_WEIGHTED_SUM_FIELD]: new BigNumber(0),
        };
      }

      const metadataInHash =
        recordsHash[hashKey][AGG_METADATA_FIELD][METADATA_SOURCES_FIELD][
          metadataKey
        ];
      const metadataOnRecord =
        record[AGG_METADATA_FIELD]?.[METADATA_SOURCES_FIELD][metadataKey];

      metadataInHash[METADATA_TOTAL_WEIGHT_FIELD] = metadataInHash[
        METADATA_TOTAL_WEIGHT_FIELD
      ].plus(
        isAggregatedRecord
          ? metadataOnRecord[METADATA_TOTAL_WEIGHT_FIELD]
          : weightValue
      );

      metadataInHash[METADATA_WEIGHTED_SUM_FIELD] = metadataInHash[
        METADATA_WEIGHTED_SUM_FIELD
      ].plus(
        isAggregatedRecord
          ? metadataOnRecord[METADATA_WEIGHTED_SUM_FIELD]
          : new BigNumber(sourceValue).times(weightValue)
      );
    });
  }

  Object.keys(recordsHash).forEach((hashKey) => {
    const record = recordsHash[hashKey];

    Object.keys(fields).forEach((outputField) => {
      const { method, sourceField, weightField } = fields[outputField];

      _.set(
        record,
        outputField,
        aggregationFunctions[method]({
          aggregationData: record[AGG_METADATA_FIELD],
          sourceField,
          weightField,
        })
      );
    });

    if (noAggregateMetadata) {
      delete record[AGG_METADATA_FIELD];
    }
  });

  const aggregatedRecords = Object.values(recordsHash);

  if (sortBy) {
    return _.sortBy(
      aggregatedRecords,
      sortBy.map((sortKey) => transformSortKeyForSort({ sortKey, buckets }))
    );
  }

  return aggregatedRecords;
}

function transformSortKeyForSort({
  sortKey,
  buckets,
}: {
  sortKey: string;
  buckets?: IBuckets;
}) {
  if (!exists(buckets?.[sortKey])) {
    return sortKey;
  }

  return (record: any) => {
    const [bucketStart] = parseBucketString(record[sortKey]);

    return bucketStart;
  };
}

function parseBucketString(bucketString: string): number[] {
  if (bucketString.startsWith("<=")) {
    return [-Infinity, Number(bucketString.slice(1))];
  }

  if (bucketString.endsWith("+")) {
    return [Number(bucketString.slice(0, -1)), Infinity];
  }

  return bucketString.split("-").map(Number);
}

function getFieldHashKey({
  record,
  matchKey,
  bucketEndpoints,
}: {
  record: any;
  matchKey: string;
  bucketEndpoints?: BucketEndpoints;
}): string {
  const value = _.get(record, matchKey);

  if (!bucketEndpoints) {
    return value;
  }

  let previousEndpoint;

  for (const endpoint of bucketEndpoints.sort()) {
    if (value <= endpoint) {
      if (!exists(previousEndpoint)) {
        return `<=${endpoint}`;
      }

      return [previousEndpoint, endpoint].join("-");
    }

    previousEndpoint = endpoint;
  }

  return `${previousEndpoint}+`;
}

function getWeightedAverageMetadataKey({
  sourceField,
  weightField,
}: {
  sourceField: string;
  weightField: string;
}): string {
  const separator = ",";

  return `weightedAverage${separator}${sourceField}${separator}${weightField}`;
}

function isSubset(subset, superset) {
  return _.difference(subset, superset).length === 0;
}

function exists(input: any) {
  return input !== undefined && input !== null;
}
