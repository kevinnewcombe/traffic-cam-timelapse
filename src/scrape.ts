// Downloads images from 511 and compares them to the most recent version on S3. If they're visually different, uploads a new image to S3.
import path from 'path';
import fs from 'fs';
import { unlink } from 'node:fs/promises';
import { Upload } from '@aws-sdk/lib-storage';
import looksSame from 'looks-same';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3, S3_BUCKET, listAllObjects } from './s3';
import https from 'https';
import { Readable } from "stream";
import sharp from 'sharp';

// Create _tmp folder if it doesn't exist
const TMP_FOLDER = path.join(__dirname, '../_tmp');
if (!fs.existsSync(TMP_FOLDER)) {
  fs.mkdirSync(TMP_FOLDER);
}

async function uploadImageToS3(filePath:string, destinationKey:string) {
  const bucketName = process.env.S3_BUCKET;

  try {
    // Resolve the full path of the file
    const absolutePath = path.resolve(filePath);

    // Ensure the file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    // Get the file stream
    const fileStream = fs.createReadStream(absolutePath);

    // upload the new image
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: bucketName,
        Key: destinationKey,
        Body: fileStream,
        ContentType: 'image/webp',
        ACL: 'public-read', // Make the file publicly accessible
      },
    });

    await upload.done();

    // Return the public URL of the uploaded image
    return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${destinationKey}`;
  } catch (error) {
    let message = 'Unknown Error'
  	if (error instanceof Error) message = error.message
    console.error('Error uploading image:',message);
    throw error; // Ensure error propagates to calling function
  }
}



async function downloadImageFromURL(url:string) {
  const filePath = path.join(TMP_FOLDER, 'new.jpg');
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get image from URL: ${url}. Status Code: ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
    }).on('error', (err: Error) => {
      fs.unlink(filePath, () => reject(err));
    });
  });
}

async function downloadLastImageFromS3(subfolder:string): Promise<string | null> {
  try {
    const data = await listAllObjects(`${subfolder}/`);
    if(!data){
      console.log(`No files found in ${subfolder}/ subfolder`);
    }
    
    // Grab the most recent image (timestamp is in filename)
    const sortedKeys = data
      .map((item) => item.Key)
      .filter((key): key is string => key !== undefined && /\.(jpg|jpeg|png|gif|webp)$/i.test(key))
      .sort();

    const lastImageKey = sortedKeys.pop();
    if (!lastImageKey) {
      console.log(`No images found in ${subfolder}`);
      return null;
    }

    const getObjectCommand = new GetObjectCommand({ Bucket: S3_BUCKET, Key: lastImageKey });
    const imageStream = await s3.send(getObjectCommand);
    const filePath = path.join(TMP_FOLDER, 'old.webp');

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      if (imageStream.Body instanceof Readable) {
        imageStream.Body.pipe(file);
        file.on('finish', () => { 
          resolve(filePath)
        });
        file.on('error', reject);
      }else{
        console.error(`Error: Body is not a Readable stream.`);
        reject(new Error(`Error downloading file to ${filePath}: Body is not a stream.`));
      }
    });
    return new Promise((resolve) => {
      resolve(filePath)
    });
  } catch (error) {
    console.error(`Error downloading the last image from S3: ${(error as Error).message}`);
    throw error;
  }
}

async function copyImages(id:string) {
  try {
    await downloadImageFromURL(`https://511.alberta.ca/map/Cctv/${id}`); // Download the image from 511
    const lastS3Image = await downloadLastImageFromS3(id); // Download the most recent image from S3

    if(lastS3Image){ // if there's a previous image in the S3 bucket... 
      await sharp(`_tmp/new.jpg`).resize(1440, null, {withoutEnlargement: true}).toFile(`_tmp/resized.webp`);
      const {equal} = await looksSame(`_tmp/resized.webp`, `_tmp/old.webp`);
      // Only upload a new image if they're visually different
      if(!equal){
        const url = await uploadImageToS3(`_tmp/resized.webp`, `${id}/${id}__timestamp${Math.floor( Date.now() / 1000)}.webp`);
        console.log(`Uploaded ${url}`);
      }else{
        console.log(`Skipping duplicate ${id}`);
      }
      await unlink(`_tmp/old.webp`);
    }else{
      await sharp(`_tmp/new.jpg`).resize(1440, null, {withoutEnlargement: true}).toFile(`_tmp/resized.webp`);
      const url = await uploadImageToS3(`_tmp/resized.webp`, `${id}/${id}__timestamp${Math.floor( Date.now() / 1000)}.webp`);
      console.log(`Uploaded ${url}`);
    }
    await unlink(`_tmp/new.jpg`);
    await unlink(`_tmp/resized.webp`);
    return true;
  } catch (error) {
    let message = 'Unknown Error'
    if (error instanceof Error) message = error.message
    console.error('Error:', message);
    return true;
  }
}



(async () => {
  const ids = [
    'banff1cam--3',
    'banff2cam--3',
    'banff4cam--3',
    'ESS_AB_014-16 WAINWRIGHT.C1--20',
    'ESS_AB_ABDOT_003-14A WHITLA.C1--20',
    'ESS_AB_ABDOT_006-04 WATERTON PARK.C3--20',
    'ESS_AB_ABDOT_022-08 RANCHLANDS.C1--20',
    'loc89C--2',
    'lul34vc1nrp--3',
    'VTMS_AB_216-06D AHDNW WHITEMUD.C1--20',
    'VTMS_AB_216-06D AHDNW WHITEMUD.C2--20',
    'VTMS_AB_216-06E AHDNW HWY16A.C2--20'
  ];
  for(const id of ids){
    await copyImages(id);
  }
  console.log('Done.');
})();


