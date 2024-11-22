# Traffic Cam Timelapse
Make a timelapse video from publicly accessible Alberta traffic cameras. Snippet of a sample video:

[Sample video](https://github.com/user-attachments/assets/300d8e07-2bae-4d7f-80f3-8e5d8f30552b)

## Details
[`scape.ts`](/src/scrape.ts) pulls images from [Alberta traffic cameras](https://511.alberta.ca/cctv) and copies them to an S3 bucket. At the time of this writing, this is currently deployed to Railway and triggered at 5 minute intervals.

The remaining files in `src/` are meant to only be run locally. `download.ts` downloads all new images to the user's machine. `video.ts` compiles the stills from each camera into a separate mp4 file.

## Future plans
At the time of this writing, 4 days after deploying this, the app is grabbing images every 5 minutes. Once it's collected a few weeks/months of images, I might want to generate videos where each frame represents a different interval (for example, 1 frame = 1 hour of elapsed time instead of the current 1 frame = 5 minutes of elapsed time), or different intervals for different date ranges. Adding the timestamp to the URL gives us some flexibility down the road if we want to write something so each frame's timestamp is a specific number of seconds after the preceding frame.

## Setup 
* Copy `.env.example` to `.env` and populate the values.

## Commands
* `npm run download` downloads all images from the S3 bucket to the local `_downloads` folder
* `npm run video` builds videos from all the images in the `_downloads` folder
* `npm run list-duplicates` goes through all files in the `_downloads` and prints a list of duplicate images to `output.txt`
