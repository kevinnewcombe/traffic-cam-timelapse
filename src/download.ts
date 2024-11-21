import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { s3, S3_BUCKET, listAllObjects } from './s3';
import fs from "fs";
const downloadsDir = '_downloads/';

const fileExists = (filePath:string) =>{
  return fs.existsSync(filePath);
}

const downloadProgress = (count:number, total:number) =>{
  console.log(`Downloading ${(Math.floor( count * 10000 / total ) / 100).toFixed(2)}%`);
}

(async () => {
  const objects = await listAllObjects('');
  let downloadedCount = 0;
  
  for(const file of objects){
    // only download images that aren't stored locally
    const localPath = `${downloadsDir}${file.Key}`;
    if(fileExists(localPath)){
      downloadedCount++;
    }else{
      const getObjectCommand = new GetObjectCommand({ Bucket: S3_BUCKET, Key: file.Key });
      const imageStream = await s3.send(getObjectCommand);
      
      const dir = localPath.split("/").slice(0,-1).join("/");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(localPath);
        if (imageStream.Body instanceof Readable) {
          imageStream.Body.pipe(file);
          file.on('finish', () => { 
            downloadProgress(downloadedCount++, objects.length);
            resolve(localPath)
          });
          file.on('error', reject);
        }else{
          console.error(`Error: Body is not a Readable stream.`);
          reject(new Error(`Error downloading file to ${localPath}: Body is not a stream.`));
        }
      });
    }
  }
  console.log('Finished downloading');
})();
