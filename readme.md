# Aggregate

This is a library for computing statistical aggregations which are composable and augmentable.

Composable means that the results of multiple aggregations can be combined.
For example, aggregations which are calculated in parallel on separate machines can be combined
into a single result.

Augmentable means that an aggregation can be continually added to as new data is available
without having to recalculate from the original data.

This is all done through a single function, `aggregate`.

## Supported Aggregation Types

- `"minimum"`
- `"maximum"`
- `"count"`
- `"sum"`
- `"average"`
- `"weightedAverage"`
- `"standardDeviation"`\*

\* Caution: For very large amounts of data, this may be inaccurate. See github [issue](https://github.com/jason00111/aggregate/issues/2).

## Aggregation Metadata

Composability and augmentability is possible because there is a field called `_aggregationMetadata`
attached to each aggregated record.
You generally shouldn't need to worry about this field, but if the aggregated records are being
stored in a database, this field must be present on each record in order to retain composability
and augmentability.

## How To Use

An options object is passed to the function like this:

```javascript
const result = aggregate({
  records: customers,
  matchKeys: ["region"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
    totalRevenue: {
      method: "sum",
      sourceField: "revenue",
    },
  },
});
```

It will return an object containing the aggregated records as well as the total aggregation over all records.
For example,

```json
{
  "aggregatedRecords": [
    {
      "region": "midwest",
      "averageRevenue": 20,
      "totalRevenue": 60
    },
    {
      "region": "northeast",
      "averageRevenue": 50,
      "totalRevenue": 150
    }
  ],
  "totals": {
    "averageRevenue": 35,
    "totalRevenue": 210
  }
}
```

Here is more detail on all possible options:

| Param                                         | Description                                                                                                                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| options                                       |                                                                                                                                                                                                                |
| options.records                               | The records to aggregate. These can include records which are the output of a previous aggregation.                                                                                                            |
| options.matchKeys                             | The fields to aggregate on. Nested fields can be accessed using path notation. Ex "a[0].b.c"                                                                                                                   |
| options.fields                                |                                                                                                                                                                                                                |
| options.fields.\<outputFieldName>             | The output field returned on the aggregated records. Nested fields are allowed using path notation. Ex "a[0].b.c"                                                                                              |
| options.fields.\<outputFieldName>.method      | The method of aggregation: either "sum", "min", "max", "average", "standardDeviation", "weightedAverage", or "count"                                                                                           |
| options.fields.\<outputFieldName>.sourceField | The field on the input records which the aggregation method acts on. Not needed for the "count" method. Nested fields can be accessed using path notation. Ex "a[0].b.c"                                       |
| options.fields.\<outputFieldName>.weightField | Only used for "weightedAverage" method. The field on the input records which is the coefficient or weight for the weighted average. Nested fields can be accessed using path notation. Ex "a[0].b.c"           |
| options.buckets                               |                                                                                                                                                                                                                |
| options.buckets.\<bucketFieldName>            | An array of breakpoints defining the bucket ranges. The bucketFieldName must be one of the match keys. If a value is on a breakpoint it is put in the lower bucket.                                            |
| options.noAggregateMetadata                   | If true, aggregation metadata will not be output on aggregated records. This is not recommended since the aggregated records cannot be augmented with new records if there is no aggregation metadata present. |
| options.sortBy                                | An array of fields to sort the output by.                                                                                                                                                                      |

##Examples

### Simple Example

Say we have the following data and we want to find the average and total revenue by region.

```javascript
const customers = [
  {
    customerId: 1,
    region: "midwest",
    revenue: 10,
  },
  {
    customerId: 2,
    region: "midwest",
    revenue: 20,
  },
  {
    customerId: 3,
    region: "midwest",
    revenue: 30,
  },
  {
    customerId: 4,
    region: "northeast",
    revenue: 40,
  },
  {
    customerId: 5,
    region: "northeast",
    revenue: 50,
  },
  {
    customerId: 6,
    region: "northeast",
    revenue: 60,
  },
];

const result = aggregate({
  records: customers,
  matchKeys: ["region"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
    totalRevenue: {
      method: "sum",
      sourceField: "revenue",
    },
  },
});
```

The value of `result` will be:

```json
{
  "aggregatedRecords": [
    {
      "region": "midwest",
      "averageRevenue": 20,
      "totalRevenue": 60
    },
    {
      "region": "northeast",
      "averageRevenue": 50,
      "totalRevenue": 150
    }
  ],
  "totals": {
    "averageRevenue": 35,
    "totalRevenue": 210
  }
}
```

As you can see above, the requested aggregated records are provided under `aggregatedRecords`.
As a bonus, the totals across all records are also provided under `totals`.

### Example with Multiple Match Keys and Structured Data

If we want to find the average and total revenue by region _and plan_, we can specify multiple match keys.
Additionally, if the data is structured, we can use path notation
(like in [lodash](https://lodash.com/docs/4.17.15#get)) to specify the keys.
Path notation is also supported for the output fields.

```javascript
const customers = [
  {
    customerId: 1,
    region: "midwest",
    other: { plan: "basic" },
    revenue: 10,
  },
  {
    customerId: 2,
    region: "midwest",
    other: { plan: "super" },
    revenue: 20,
  },
  {
    customerId: 3,
    region: "midwest",
    other: { plan: "basic" },
    revenue: 30,
  },
  {
    customerId: 4,
    region: "northeast",
    other: { plan: "super" },
    revenue: 40,
  },
  {
    customerId: 5,
    region: "northeast",
    other: { plan: "basic" },
    revenue: 50,
  },
  {
    customerId: 6,
    region: "northeast",
    other: { plan: "super" },
    revenue: 60,
  },
];

const result = aggregate({
  records: customers,
  matchKeys: ["region", "other.plan"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
    totalRevenue: {
      method: "sum",
      sourceField: "revenue",
    },
    "extra.numberOfCustomers": {
      method: "count",
    },
  },
});
```

The value of `result` will be:

```json
{
  "aggregatedRecords": [
    {
      "region": "midwest",
      "other": {
        "plan": "basic"
      },
      "averageRevenue": 20,
      "totalRevenue": 40,
      "extra": {
        "numberOfCustomers": 2
      }
    },
    {
      "region": "midwest",
      "other": {
        "plan": "super"
      },
      "averageRevenue": 20,
      "totalRevenue": 20,
      "extra": {
        "numberOfCustomers": 1
      }
    },
    {
      "region": "northeast",
      "other": {
        "plan": "super"
      },
      "averageRevenue": 50,
      "totalRevenue": 100,
      "extra": {
        "numberOfCustomers": 2
      }
    },
    {
      "region": "northeast",
      "other": {
        "plan": "basic"
      },
      "averageRevenue": 50,
      "totalRevenue": 50,
      "extra": {
        "numberOfCustomers": 1
      }
    }
  ],
  "totals": {
    "averageRevenue": 35,
    "totalRevenue": 210,
    "extra": {
      "numberOfCustomers": 6
    }
  }
}
```

### Example with Buckets

If we want to find the average and total revenue by age range, we can use buckets.

```javascript
const customers = [
  {
    customerId: 1,
    age: 10,
    revenue: 60,
  },
  {
    customerId: 2,
    age: 20,
    revenue: 50,
  },
  {
    customerId: 3,
    age: 30,
    revenue: 40,
  },
  {
    customerId: 4,
    age: 40,
    revenue: 30,
  },
  {
    customerId: 5,
    age: 50,
    revenue: 20,
  },
  {
    customerId: 6,
    age: 60,
    revenue: 10,
  },
];

const result = aggregate({
  records: customers,
  matchKeys: ["age"],
  buckets: {
    age: [0, 25, 50],
  },
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
    totalRevenue: {
      method: "sum",
      sourceField: "revenue",
    },
    numberOfCustomers: {
      method: "count",
    },
  },
});
```

The value of `result` will be:

```json
{
  "aggregatedRecords": [
    {
      "age": "0-25",
      "averageRevenue": 55,
      "totalRevenue": 110,
      "numberOfCustomers": 2
    },
    {
      "age": "25-50",
      "averageRevenue": 35,
      "totalRevenue": 70,
      "numberOfCustomers": 2
    },
    {
      "age": "50+",
      "averageRevenue": 15,
      "totalRevenue": 30,
      "numberOfCustomers": 2
    }
  ],
  "totals": {
    "averageRevenue": 35,
    "totalRevenue": 210,
    "numberOfCustomers": 6
  }
}
```

### Example of Weighted Average

Say we want to find the average customer revenue, but we want it to be weighted by the number
of days a customer was active. We can use the "weightedAverage" method.

```javascript
const customers = [
  {
    customerId: 1,
    region: "midwest",
    revenue: 10,
    daysActive: 51,
  },
  {
    customerId: 2,
    region: "midwest",
    revenue: 20,
    daysActive: 52,
  },
  {
    customerId: 3,
    region: "midwest",
    revenue: 30,
    daysActive: 53,
  },
  {
    customerId: 4,
    region: "northeast",
    revenue: 40,
    daysActive: 54,
  },
  {
    customerId: 5,
    region: "northeast",
    revenue: 50,
    daysActive: 55,
  },
  {
    customerId: 6,
    region: "northeast",
    revenue: 60,
    daysActive: 56,
  },
];

const result = aggregate({
  records: customers,
  matchKeys: ["region"],
  fields: {
    weightedAverageRevenue: {
      method: "weightedAverage",
      sourceField: "revenue",
      weightField: "daysActive",
    },
  },
});
```

The value of `result` will be:

```json
{
  "aggregatedRecords": [
    {
      "region": "midwest",
      "weightedAverageRevenue": 20.128205128205128
    },
    {
      "region": "northeast",
      "weightedAverageRevenue": 50.121212121212125
    }
  ],
  "totals": {
    "weightedAverageRevenue": 35.545171339563865
  }
}
```

### Example of Composition

We can put the results of two aggregations together.

```javascript
const customersChunk1 = [
  {
    customerId: 1,
    region: "midwest",
    revenue: 10,
  },
  {
    customerId: 2,
    region: "midwest",
    revenue: 20,
  },
  {
    customerId: 3,
    region: "midwest",
    revenue: 30,
  },
  {
    customerId: 4,
    region: "northeast",
    revenue: 40,
  },
  {
    customerId: 5,
    region: "northeast",
    revenue: 50,
  },
  {
    customerId: 6,
    region: "northeast",
    revenue: 60,
  },
];

const customersChunk2 = [
  {
    customerId: 7,
    region: "midwest",
    revenue: 70,
  },
  {
    customerId: 8,
    region: "midwest",
    revenue: 80,
  },
  {
    customerId: 9,
    region: "northeast",
    revenue: 90,
  },
  {
    customerId: 10,
    region: "northeast",
    revenue: 100,
  },
];

const resultChunk1 = aggregate({
  records: customersChunk1,
  matchKeys: ["region"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
  },
});

const resultChunk2 = aggregate({
  records: customersChunk2,
  matchKeys: ["region"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
  },
});

const combinedResult = aggregate({
  records: [
    ...resultChunk1.aggregatedRecords,
    ...resultChunk2.aggregatedRecords,
  ],
  matchKeys: ["region"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
  },
});
```

The value of `combinedResult` will be:

```json
{
  "aggregatedRecords": [
    {
      "region": "midwest",
      "averageRevenue": 42
    },
    {
      "region": "northeast",
      "averageRevenue": 68
    }
  ],
  "totals": {
    "averageRevenue": 55
  }
}
```

### Example of Augmentation

We can add new records to an already calculated aggregation.

```javascript
const customers = [
  {
    customerId: 1,
    region: "midwest",
    revenue: 10,
  },
  {
    customerId: 2,
    region: "midwest",
    revenue: 20,
  },
  {
    customerId: 3,
    region: "midwest",
    revenue: 30,
  },
  {
    customerId: 4,
    region: "northeast",
    revenue: 40,
  },
  {
    customerId: 5,
    region: "northeast",
    revenue: 50,
  },
  {
    customerId: 6,
    region: "northeast",
    revenue: 60,
  },
];

const result = aggregate({
  records: customers,
  matchKeys: ["region"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
  },
});

const newCustomers = [
  {
    customerId: 7,
    region: "midwest",
    revenue: 70,
  },
  {
    customerId: 8,
    region: "midwest",
    revenue: 80,
  },
  {
    customerId: 9,
    region: "northeast",
    revenue: 90,
  },
  {
    customerId: 10,
    region: "northeast",
    revenue: 100,
  },
];

const updatedResult = aggregate({
  records: [...result.aggregatedRecords, ...newCustomers],
  matchKeys: ["region"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
  },
});
```

The value of `updatedResult` will be:

```json
{
  "aggregatedRecords": [
    {
      "region": "midwest",
      "averageRevenue": 42
    },
    {
      "region": "northeast",
      "averageRevenue": 68
    }
  ],
  "totals": {
    "averageRevenue": 55
  }
}
```
