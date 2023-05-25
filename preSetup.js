const { exec } = require('node:child_process')
const path = require("path");

// Clone Repo
const codeRepoLink = process.env.MP_GITHUB_CO_UI_REPO_LINK; //MP_GITHUB_ECR_REPO_LINK

exec(`git clone ${codeRepoLink}`, (error, output)=>{
  if (error){
    console.log("Failed to clone client onboarding UI codebase", error);
    return;
  }
  console.log("Successfully cloned client onboarding UI codebase", output);

  // Run npm run build inside codebase
  exec(`cd client-onboarding && npm ci && npm run build && cd ..`, (error1, output1)=>{
    if (error1){
      console.log("Error create build from Client Onboarding codebase", error1);
      return;
    }
    console.log("Successfully ran build on Client Onboarding codebase", output1);

    // Create directory Services and copy infra contents from cloned repo
    exec(`mkdir services && mkdir services/adminUi && cp -r client-onboarding/infra/* services/ && cp -r client-onboarding/dist/* services/adminUi/`, (error11, output11)=>{
      if (error11){
        console.log("Error ", error11);
        console.log("Error with pre-setup");
        return
      }
      console.log("All setup completed successfully with pre-setup")
    })
  })
})

