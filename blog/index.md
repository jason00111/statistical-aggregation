## Introduction

Getting statistics from a large amount of data can be a challenging problem. For example, how can we find the average customer revenue in each geographical region if we have way more data than can fit on a single machine?

At [SnapStrat](https://snapstrat.com/), we solved this problem by splitting the data into chunks, aggregating each chunk on a separate server, and then aggregating the aggregations into a final result. This solution is fast and scalable.

In this post I will discuss one part of this solution: a library allowing statistical aggregations to be computed in a way in which they can be merged with other aggregations, enabling this parallel architecture.

This library is available on [github](https://github.com/jason00111/statistical-aggregation) and [NPM](https://www.npmjs.com/package/statistical-aggregation).

## Example

This is a rough, hypothetical example of how the library could be used. Let's say we have customer data in a database which looks like this.

```json
[
  {
    customerId: "831962",
    region: "midwest",
    revenue: 92,
  },
  {
    customerId: "805835",
    region: "northeast",
    revenue: 16,
  },
  ...
]
```

Through a process not described here, a bunch of servers are each given a chunk number and caused to run the following code.

```javascript
const { aggregate } = require("statistical-aggregation");

const customers = await getFromDatabase({
  entity: "Customer",
  chunkNumber,
});

const aggregationOptions = {
  matchKeys: ["region"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
  },
};

const { aggregatedRecords } = aggregate({
  records: customers,
  ...aggregationOptions,
});

await sendToAccumulator({
  customers: aggregatedRecords,
  chunkNumber,
});
```

This finds the average customer revenue by region for each chunk and sends the results to another server, the accumulator. This server uses the code below to accumulate the results from each chunk server into a final aggregation and then write to the database.

```javascript
const { aggregate } = require("statistical-aggregation");
const express = require("express");

const app = express();

let finalResult;
const collectedChunkNumbers = new Set();

const aggregationOptions = {
  matchKeys: ["region"],
  fields: {
    averageRevenue: {
      method: "average",
      sourceField: "revenue",
    },
  },
};

app.post("/customer-stream", (request) => {
  ({ aggregatedRecords: finalResult } = aggregate({
    records: [...request.body.customers, ...finalResult],
    ...aggregationOptions,
  }));

  collectedChunkNumbers.add(request.body.chunkNumber);

  checkIfDone();
});

function checkIfDone() {
  if (collectedChunkNumbers.size === numberOfChunks) {
    writeToDatabase(finalResult);
  }
}
```

This is just a handwavy, illustrative example to give you the basic idea.

## How Does it Work?

Say we have 10 pencils which have lengths in inches of `3.5`, `3.2`, `3.8`, `3.5`, `3.4`, `3.6`, `3.3`, `3.7` and `7.6`, and `7.4`. The average length of the shortest `8` pencils is `3.5`. The average length of the remaining `2` pencils is `7.5`. Notice that the average of `3.5` and `7.5` is `5.5`, but the average length of all the pencils is `4.3`.

This shows that if we calculate averages in chunks, we can't just average the averages to find the overall average. The trick is to keep track of the _sum_ and the _count_ for each chunk. These can be combined to get the overall average.

For the chunk of shorter pencils, the count is `8` and the sum is `28`. For the chunk of longer pencils the count is `2` and the sum is `15`. To get the overall average, we take the total sum, `28 + 15`, and divide it by the total count, `8 + 2`. This gives `43` divided by `10`, which is `4.3`, the correct answer.

It's similar for weighted average and standard deviation. For weighted average we need to keep track of the _weighted sum_ and the _total weight_. For standard deviation we need to track the _sum_, the _sum of squares_, and the _count_.

The following equations show how we can find the desired aggregations from this metadata. The {% katex inline %}\sum{% endkatex %} symbol indicates to add over all the chunks.

$$
average = \frac{ \sum sum }{ \sum count }
$$

$$
weighted \space average =
\frac{ \sum weighted \space sum }{ \sum total \space weight }
$$

$$
standard \space deviation =
\sqrt{
\frac{ \sum sum \space of \space squares }{ \sum count }
-
\bigg( \frac{ \sum sum }{ \sum count } \bigg) ^ 2
}
$$

In the statistical-aggregation library, all this metadata is tracked in an object labeled `_aggregationMetadata` which is attached to each aggregated record.

This ability to combine the results of multiple aggregations into one is called composability and can be stated in mathematical notation as,

$$
F(\\{a, b, c, d\\})
= F(\\{F(\\{a, b\\}), \space F(\\{c, d\\})\\})
$$

## Other Requirements

### Buckets

We ran into cases where we needed to aggregate into buckets or ranges of numeric data. For example, finding the average customer revenue for different age ranges.

### Structured Data

The data was often structured and the relevant number may be nested within the record. Our engineers were already familiar with path notation (as used in [lodash](https://lodash.com/docs/4.17.15#get)) so this is supported. For example, the path to the relevant field in the record below is specified as `revenue.q1`.

```json
{
  "revenue": {
    "q1": 47.82
  }
}
```

### Totals

In most use cases, the total aggregation across all records was desired. For example, if we were finding the average customer revenue in each geographical region, we'd also want the average revenue across all regions.

## Challenges

I ran into a problem where, for very large amounts of data, the _sum_ and _sum of squares_ stored in the metadata could get too large for a JavaScript number to handle accurately. This resulted in inaccurate standard deviations and averages. The problem was solved by using a big number library.

## Conclusion

It was fun to figure out this method. There are other ways to do this, but this one is straightforward and easy to understand, which is desirable when maintaining a codebase over the lifetime of a company.

---

Cover image courtesy of monkik from the Noun Project.
