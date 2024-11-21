const fs = require('fs/promises');
const looksSame = require('looks-same')
const downloadsDir = '_downloads/';
import { lstatSync } from 'node:fs'; 
export const isDirectory = (path:string) => lstatSync(path) ? lstatSync(path).isDirectory() : false;
const start = async () =>{
  await fs.writeFile('output.txt', 'List of duplicates\n\n', (err:any) => {
    if (err) {
      console.error(err);
    }
  });

  await fs.readdir(downloadsDir) .then(async (folders: []) => {
    let totalSubfoldersCount = 0;
    let currentSubfolderIndex = 0;

    for(let id of folders){
      if(isDirectory(`${downloadsDir}${id}`)){
        totalSubfoldersCount++;
      }
    }
    for(let id of folders){
    // for(let id of ['banff1cam--3']){
      const downloadIdDir = `${downloadsDir}${id}`;
      if(isDirectory(`${downloadsDir}${id}`)){

        console.log(`${downloadIdDir} is a directory`)
        // loop through all files
        
        await fs.readdir(downloadIdDir) .then(async (downloadIdFiles: []) => {
          const files = downloadIdFiles.filter((file:string) => file.includes('.webp'));
          let duplicatesCount = 0;
          for(let i=1; i<files.length - 1; i++){
            let a = `${downloadIdDir}/${files[i - 1]}`;
            let b = `${downloadIdDir}/${files[i]}`;
            const {equal} = await looksSame(a, b);
            if(equal){
              await fs.writeFile('output.txt', `${a} \n`, { flag: 'a+' }, (err: any) => {
                if(err){ console.error(`error: ${err}`) };
              });
            }
            console.log(`Comparing image: ${ i } of ${files.length} | folders: ${currentSubfolderIndex} of ${totalSubfoldersCount }`)
          }
        });
        currentSubfolderIndex++;
      }
    }
  });
  console.log('DONE');
}

start();
