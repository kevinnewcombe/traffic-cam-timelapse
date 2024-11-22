/*
  Download all images and compile them in to a seperate video for each id
*/
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { s3, S3_BUCKET, listAllObjects } from './s3';
const fsPromises = require('fs/promises');
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
import fs from "fs";
const downloadsDir = '_downloads/';

// Start / interval parameters (in seconds) for video creation. Change these both to 0 to use _all_ images. 
const startTimestamp = Math.floor( Date.now() / 1000) - (60 * 60 * 24);
const minInterval = 60 * 5;

const startString = 'timestamp';
const endString = '.webp';

ffmpeg.setFfmpegPath(ffmpegStatic);
const createVideo = async(id:string) => {
  const targetDir = `_sequence/images/${id}`;
  return new Promise<void>((resolve,reject)=>{
    ffmpeg()
      .input(`${targetDir}/%04d.webp`)
      .inputOptions('-framerate', '30')
      .videoCodec('libx264')
      .outputOptions('-pix_fmt', 'yuv420p')
      .saveToFile(`_sequence/videos/${id}.mp4`)
      .on('progress', (progress:{percent:number}) => {
        if (progress.percent) {
          if(progress.percent >= 0 && progress.percent <= 100){
            console.log(`Creating ${id}.mp4 ${Math.floor(progress.percent)}%`);
          }
        }
      })
      .on('end', () => {
        fsPromises.rm(`_sequence/images/${id}`, { recursive: true, force: true });
        console.log(`Finished video for ${id}\n`);
        return resolve();
      })
      .on('error', (error:string) => {
        console.error(id, error);
        return reject(error)
      });

  });
 }

 

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
  console.log('Finished downloading\n');
  await fsPromises.rm('_sequence/', { recursive: true, force: true }); 
  await fsPromises.mkdir(`_sequence/videos/`, { recursive: true })
  await fsPromises.readdir(downloadsDir) .then(async (allFolders: []) => {
    let stat;
    const folders:[] = [];
    for(let id of allFolders){
      const downloadIdFolder = `${downloadsDir}${id}`;
      stat = await fsPromises.stat(downloadIdFolder);
      if(stat.isDirectory()){
        folders.push(id);
      }
    }

    for (let j=0; j<folders.length; j++) {
      const id = folders[j];
      const downloadIdFolder = `${downloadsDir}${id}`;
      console.log(`Starting ${id} (${j+1} of ${folders.length})`);
      const targetDir = `_sequence/images/${id}`;
      await fsPromises.mkdir(targetDir, { recursive: true })
      const files = await fsPromises.readdir(downloadIdFolder);
      let currentTimestamp = 0;  
      let currentIndex = 0;
      for(let i = 0; i<files.length; i++){
          const filename = files[i];
          const tsStart = filename.indexOf(startString) + startString.length;
          const tsEnd = filename.indexOf(endString, tsStart);
          const timestamp = parseInt(filename.substring(tsStart, tsEnd), 10);
          if(timestamp > startTimestamp && timestamp - currentTimestamp > minInterval){
            currentTimestamp = timestamp;
            const src = `${downloadIdFolder}/${files[i]}`;
            const dest = `${targetDir}/${(currentIndex++).toString().padStart(4, "0")}.webp`; 
            await fsPromises.copyFile(src, dest, 0, (err:any) => {
              if (err) {
                console.log("Error Found:", err);
              }
            });
          }

        }
        await createVideo(id);
      }// end of folder
  });
  console.log("Finished creating videos");
})();
