const fs = require('fs/promises');
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const downloadsPath = '_downloads/';

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
        fs.rm(`_sequence/images/${id}`, { recursive: true, force: true });
        console.log(`Finished video for ${id}\n\n`);
        return resolve();
      })
      .on('error', (error:string) => {
        console.error(id, error);
        return reject(error)
      });

  });
 }

 
 (async () => {
  await fs.rm('_sequence/', { recursive: true, force: true }); 
  await fs.mkdir(`_sequence/videos/`, { recursive: true })
  await fs.readdir(downloadsPath) .then(async (allFolders: []) => {
    let stat;
    const folders:[] = [];
    for(let id of allFolders){
      const downloadIdFolder = `${downloadsPath}${id}`;
      stat = await fs.stat(downloadIdFolder);
      if(stat.isDirectory()){
        folders.push(id);
      }
    }

    for (let j=0; j<folders.length; j++) {
      const id = folders[j];
      const downloadIdFolder = `${downloadsPath}${id}`;
      console.log(`Starting ${id} (${j+1} of ${folders.length})`);
      const targetDir = `_sequence/images/${id}`;
      await fs.mkdir(targetDir, { recursive: true })
      const files = await fs.readdir(downloadIdFolder);
        for(let i = 0; i<files.length; i++){
          const src = `${downloadIdFolder}/${files[i]}`;
          const dest = `${targetDir}/${(i + 1).toString().padStart(4, "0")}.webp`; 
          await fs.copyFile(src, dest, 0, (err:any) => {
            if (err) {
              console.log("Error Found:", err);
            }
          });
        }
        await createVideo(id);
      }// end of folder
  });
  console.log("Finished creating videos");
})();
