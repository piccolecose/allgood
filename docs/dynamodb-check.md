# DynamoDB check

Added for [issue #7](https://github.com/piccolecose/allgood/issues/7).

`@aws-sdk/client-dynamodb` is an optional peer dependency. It loads only when the check runs, which keeps the AWS SDK out of installs that don't use DynamoDB.

The check calls `DescribeTable`. It is a cheap control-plane call that proves the credentials work, the table exists and its status is healthy, without reading any data.

The call aborts after 5 seconds and the check fails with value `timeout`, as the database and cache checks do.
