require('dotenv').config();
import { S3Client, ListObjectsV2CommandOutput, ListObjectsV2Command } from '@aws-sdk/client-s3';

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  S3_BUCKET: rawS3Bucket,
} = process.env;

// Validate all required environment variables
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !rawS3Bucket) {
  throw new Error("Missing required AWS environment variables.");
}

// Explicitly type S3_BUCKET as a string after validation
const S3_BUCKET: string = rawS3Bucket;

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const listAllObjects = async (prefix:string) => {
  let allContents: Required<ListObjectsV2CommandOutput>['Contents'] = [];
  let continuationToken: string | undefined = undefined;
  
  do {
    const data: ListObjectsV2CommandOutput = await s3.send(
      new ListObjectsV2Command({
        Bucket: rawS3Bucket,
        ContinuationToken: continuationToken,
        Prefix: prefix 
      })
    );

    if (data.Contents) {
      allContents = allContents.concat(data.Contents);
    }

    continuationToken = data.NextContinuationToken;
  } while (continuationToken);

  return allContents;
};

export {
  S3_BUCKET,
  s3,
  listAllObjects
};
