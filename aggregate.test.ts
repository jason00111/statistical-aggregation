import { AGG_METADATA_FIELD, AggregationTypes, aggregate } from "./aggregate";

import { assert } from "chai";

const ERROR_MARGIN = 5e-14;

describe("aggregate.test", () => {
  it("aggregate", () => {
    const testId = 0;
    const records = [
      {
        id: { nestedField: testId },
        topField1: 0,
        topField2: [{ nestedField: 0 }],
      },
      {
        id: { nestedField: testId },
        topField1: 1,
        topField2: [{ nestedField: 2 }],
      },
      {
        id: { nestedField: testId },
        topField1: 2,
        topField2: [{ nestedField: 4 }],
      },
      {
        id: { nestedField: testId },
        topField1: 2,
        topField2: [{ nestedField: 4 }],
      },
      {
        id: { nestedField: testId },
        topField1: 3,
        topField2: [{ nestedField: 6 }],
      },
    ];

    // const expectedSum1 = 8;
    // const expectedMin1 = 0;
    const expectedMax1 = 3;
    const expectedAverage1 = 1.6;
    const expectedStandardDeviation1 = 1.0198039027186;

    const expectedSum2 = 16;
    const expectedMin2 = 0;
    // const expectedMax2 = 6;
    // const expectedAverage2 = 3.2;
    // const expectedStandardDeviation2 = 2.0396078054371

    const expectedWeightedAverage = 4.5;
    const expectedCount = 5;

    const { aggregatedRecords, totals } = aggregate({
      records,
      matchKeys: ["id.nestedField"],
      fields: {
        "sumField[0].nestedField": {
          method: AggregationTypes.sum,
          sourceField: "topField2[0].nestedField",
        },
        minField: {
          method: AggregationTypes.min,
          sourceField: "topField2[0].nestedField",
        },
        maxField: {
          method: AggregationTypes.max,
          sourceField: "topField1",
        },
        averageField: {
          method: AggregationTypes.average,
          sourceField: "topField1",
        },
        countField: {
          method: AggregationTypes.count,
        },
        standardDeviationField: {
          method: AggregationTypes.standardDeviation,
          sourceField: "topField1",
        },
        weightedAverageField: {
          method: AggregationTypes.weightedAverage,
          sourceField: "topField2[0].nestedField",
          weightField: "topField1",
        },
      },
    });

    assert.isArray(aggregatedRecords);
    assert.lengthOf(aggregatedRecords, 1);
    assert.deepInclude(aggregatedRecords[0], {
      id: { nestedField: testId },
      sumField: [{ nestedField: expectedSum2 }],
      minField: expectedMin2,
      maxField: expectedMax1,
      averageField: expectedAverage1,
      countField: expectedCount,
      weightedAverageField: expectedWeightedAverage,
    });
    assert.approximately(
      aggregatedRecords[0].standardDeviationField,
      expectedStandardDeviation1,
      ERROR_MARGIN
    );
    assert.exists(aggregatedRecords[0][AGG_METADATA_FIELD]);

    assert.exists(totals);
    assert.deepInclude(totals, {
      sumField: [{ nestedField: expectedSum2 }],
      minField: expectedMin2,
      maxField: expectedMax1,
      averageField: expectedAverage1,
      countField: expectedCount,
      weightedAverageField: expectedWeightedAverage,
    });
    assert.approximately(
      totals.standardDeviationField,
      expectedStandardDeviation1,
      ERROR_MARGIN
    );
    assert.exists(totals[AGG_METADATA_FIELD]);
  });

  it("aggregate already aggregated data", () => {
    const testId = 0;
    const records1 = [
      {
        id: testId,
        field1: 0,
        field2: 0,
      },
      {
        id: testId,
        field1: 1,
        field2: 1,
      },
      {
        id: testId,
        field1: 2,
        field2: 2,
      },
      {
        id: testId,
        field1: 3,
        field2: 3,
      },
    ];

    const records2 = [
      {
        id: testId,
        field1: 0,
        field2: 0,
      },
      {
        id: testId,
        field1: 2,
        field2: 2,
      },
      {
        id: testId,
        field1: 4,
        field2: 4,
      },
      {
        id: testId,
        field1: 6,
        field2: 6,
      },
    ];

    const expectedCount1 = records1.length;
    const expectedCount2 = records2.length;
    const expectedCountTotal = expectedCount1 + expectedCount2;

    const expectedStandardDeviation1 = 1.1180339887499;
    const expectedStandardDeviation2 = 2.2360679774998;
    const expectedStandardDeviationTotal = 1.9202864369672;

    const expectedWeightedAverage1 = 2.3333333333333;
    const expectedWeightedAverage2 = 4.6666666666667;
    const expectedWeightedAverageTotal = 3.8888888888889;

    const baseAggregationOptions = {
      matchKeys: ["id"],
      fields: {
        standardDeviationField: {
          method: AggregationTypes.standardDeviation,
          sourceField: "field1",
        },
        countField: {
          method: AggregationTypes.count,
        },
        weightedAverageField: {
          method: AggregationTypes.weightedAverage,
          sourceField: "field1",
          weightField: "field2",
        },
      },
    };

    const { aggregatedRecords: aggregatedRecords1 } = aggregate({
      ...baseAggregationOptions,
      records: records1,
    });

    assert.isArray(aggregatedRecords1);
    assert.lengthOf(aggregatedRecords1, 1);
    assert.equal(aggregatedRecords1[0].countField, expectedCount1);
    assert.approximately(
      aggregatedRecords1[0].standardDeviationField,
      expectedStandardDeviation1,
      ERROR_MARGIN
    );
    assert.approximately(
      aggregatedRecords1[0].weightedAverageField,
      expectedWeightedAverage1,
      ERROR_MARGIN
    );
    assert.exists(aggregatedRecords1[0][AGG_METADATA_FIELD]);

    const { aggregatedRecords: aggregatedRecords2 } = aggregate({
      ...baseAggregationOptions,
      records: records2,
    });

    assert.isArray(aggregatedRecords2);
    assert.lengthOf(aggregatedRecords2, 1);
    assert.equal(aggregatedRecords2[0].countField, expectedCount2);
    assert.approximately(
      aggregatedRecords2[0].standardDeviationField,
      expectedStandardDeviation2,
      ERROR_MARGIN
    );
    assert.approximately(
      aggregatedRecords2[0].weightedAverageField,
      expectedWeightedAverage2,
      ERROR_MARGIN
    );
    assert.exists(aggregatedRecords2[0][AGG_METADATA_FIELD]);

    const { aggregatedRecords: aggregatedRecordsTotalA } = aggregate({
      ...baseAggregationOptions,
      records: aggregatedRecords1.concat(aggregatedRecords2),
    });

    assert.isArray(aggregatedRecordsTotalA);
    assert.lengthOf(aggregatedRecordsTotalA, 1);
    assert.equal(aggregatedRecordsTotalA[0].countField, expectedCountTotal);
    assert.approximately(
      aggregatedRecordsTotalA[0].standardDeviationField,
      expectedStandardDeviationTotal,
      ERROR_MARGIN
    );
    assert.approximately(
      aggregatedRecordsTotalA[0].weightedAverageField,
      expectedWeightedAverageTotal,
      ERROR_MARGIN
    );
    assert.exists(aggregatedRecordsTotalA[0][AGG_METADATA_FIELD]);

    const { aggregatedRecords: aggregatedRecordsTotalB } = aggregate({
      ...baseAggregationOptions,
      records: aggregatedRecords1.concat(records2),
    });

    assert.isArray(aggregatedRecordsTotalB);
    assert.lengthOf(aggregatedRecordsTotalB, 1);
    assert.equal(aggregatedRecordsTotalB[0].countField, expectedCountTotal);
    assert.approximately(
      aggregatedRecordsTotalB[0].standardDeviationField,
      expectedStandardDeviationTotal,
      ERROR_MARGIN
    );
    assert.approximately(
      aggregatedRecordsTotalB[0].weightedAverageField,
      expectedWeightedAverageTotal,
      ERROR_MARGIN
    );
    assert.exists(aggregatedRecordsTotalB[0][AGG_METADATA_FIELD]);
  });

  it("aggregate already aggregated data on a subset of match keys", () => {
    const testIdA = 0;
    const testIdB1 = 0;
    const testIdB2 = 1;
    const records = [
      {
        idA: testIdA,
        idB: testIdB1,
        field: 0,
      },
      {
        idA: testIdA,
        idB: testIdB1,
        field: 1,
      },
      {
        idA: testIdA,
        idB: testIdB2,
        field: 2,
      },
      {
        idA: testIdA,
        idB: testIdB2,
        field: 3,
      },
    ];

    const expectedStandardDeviation1 = 0.5;
    const expectedStandardDeviation2 = 0.5;
    const expectedStandardDeviationTotal = 1.1180339887499;

    const { aggregatedRecords, totals } = aggregate({
      records,
      matchKeys: ["idA", "idB"],
      fields: {
        standardDeviationField: {
          method: AggregationTypes.standardDeviation,
          sourceField: "field",
        },
        countField: {
          method: AggregationTypes.count,
        },
      },
    });

    assert.isArray(aggregatedRecords);
    assert.lengthOf(aggregatedRecords, 2);

    const aggregatedRecord1 = aggregatedRecords.find(
      (rec) => rec.idB === testIdB1
    );
    const aggregatedRecord2 = aggregatedRecords.find(
      (rec) => rec.idB === testIdB2
    );

    assert.exists(aggregatedRecord1);
    assert.exists(aggregatedRecord2);

    assert.equal(aggregatedRecord1.countField, 2);
    assert.approximately(
      aggregatedRecord1.standardDeviationField,
      expectedStandardDeviation1,
      ERROR_MARGIN
    );
    assert.exists(aggregatedRecord1[AGG_METADATA_FIELD]);

    assert.equal(aggregatedRecord2.countField, 2);
    assert.approximately(
      aggregatedRecord2.standardDeviationField,
      expectedStandardDeviation2,
      ERROR_MARGIN
    );
    assert.exists(aggregatedRecord2[AGG_METADATA_FIELD]);

    assert.exists(totals);
    assert.equal(totals.countField, 4);
    assert.approximately(
      totals.standardDeviationField,
      expectedStandardDeviationTotal,
      ERROR_MARGIN
    );
    assert.exists(totals[AGG_METADATA_FIELD]);

    const { aggregatedRecords: reAggregatedRecords } = aggregate({
      records: aggregatedRecords,
      matchKeys: ["idA"],
      fields: {
        standardDeviationField: {
          method: AggregationTypes.standardDeviation,
          sourceField: "field",
        },
        countField: {
          method: AggregationTypes.count,
        },
      },
    });

    assert.isArray(reAggregatedRecords);
    assert.lengthOf(reAggregatedRecords, 1);
    assert.equal(reAggregatedRecords[0].countField, 4);
    assert.approximately(
      reAggregatedRecords[0].standardDeviationField,
      expectedStandardDeviationTotal,
      ERROR_MARGIN
    );
    assert.exists(reAggregatedRecords[0][AGG_METADATA_FIELD]);
  });

  it("aggregate by bucket ranges", () => {
    const records = [
      {
        price: -1,
        field: -1,
      },
      {
        price: 0,
        field: 0,
      },
      {
        price: 5,
        field: 1,
      },
      {
        price: 11,
        field: 2,
      },
      {
        price: 19,
        field: 3,
      },
      {
        price: 23,
        field: 22,
      },
    ];

    const expectedCount = [1, 2, 2, 1];
    const expectedCountTotal = 6;

    const expectedAverage = [-1, 0.5, 2.5, 22];
    const expectedAverageTotal = 4.5;

    const expectedAveragePrice = [-1, 2.5, 15, 23];
    const expectedAveragePriceTotal = 9.5;

    const bucketString = ["<0", "0-10", "10-20", "20+"];

    const { aggregatedRecords, totals } = aggregate({
      records,
      matchKeys: ["price"],
      buckets: {
        price: [0, 10, 20],
      },
      sortBy: ["price"],
      fields: {
        averageField: {
          method: AggregationTypes.average,
          sourceField: "field",
        },
        averagePriceField: {
          method: AggregationTypes.average,
          sourceField: "price",
        },
        countField: {
          method: AggregationTypes.count,
        },
      },
    });

    assert.isArray(aggregatedRecords);
    assert.lengthOf(aggregatedRecords, 4);

    for (let index = 0; index < aggregatedRecords.length; index++) {
      assert.deepInclude(aggregatedRecords[index], {
        price: bucketString[index],
        countField: expectedCount[index],
        averageField: expectedAverage[index],
        averagePriceField: expectedAveragePrice[index],
      });
      assert.exists(aggregatedRecords[index][AGG_METADATA_FIELD]);
    }

    assert.deepInclude(totals, {
      countField: expectedCountTotal,
      averageField: expectedAverageTotal,
      averagePriceField: expectedAveragePriceTotal,
    });
    assert.exists(totals[AGG_METADATA_FIELD]);
  });
});
