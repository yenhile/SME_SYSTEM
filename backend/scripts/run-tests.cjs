// Unit tests start from a closed Portal rollout regardless of local operating .env.
// Individual tests may explicitly enable policies inside their owned fixture.
const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['--test',...process.argv.slice(2)],{
  stdio:'inherit',env:{...process.env,NODE_ENV:'test',PORTAL_V2_ROLLOUT_ENABLED:'false',PORTAL_FOUNDATION_PREVIEW:'false',PORTAL_V2_SUBMIT_ENABLED:'false',PORTAL_V2_INTAKE_ENABLED:'false'},windowsHide:true,
});
if(result.error)console.error(result.error.message);
process.exitCode=result.status??1;
