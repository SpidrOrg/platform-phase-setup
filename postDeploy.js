const path = require("path");
const fs = require("fs");
const { exec } = require('node:child_process');

let postDeployContents = fs.readFileSync("./lakePermissionTemplate.json");
postDeployContents = postDeployContents.replaceAll(":123456789012:");
fs.writeFileSync("./lakePermission.json", postDeployContents)

exec(`aws lakeformation put-data-lake-settings --cli-input-json file://lakePermission.json`, (err, output) => {
  if (err){
    console.log("Failed to updated lakeformation permissions", err);
  } else {
    console.log("Updated lakeformation permissions", output)
  }
})
