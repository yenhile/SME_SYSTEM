// Contract adapter for existing synthetic-fixture runners only.
// Safety regression tests send explicit raw bodies and never use this adapter.
const {randomUUID}=require('node:crypto');
async function assignmentFixture(db,endpoint,body){
  if(!body||typeof body!=='object'||body instanceof FormData)return body;
  const portal=endpoint.match(/^\/portal-intakes\/([^/]+)\/assign$/),loan=endpoint.match(/^\/assignments\/([^/]+)\/reassign$/);
  if(!portal&&!loan)return body;
  const row=await db[portal?'portalRequest':'loanApplication'].findUnique({where:{id:(portal||loan)[1]},select:{assignmentVersion:true}});
  return{expectedAssignmentVersion:row?.assignmentVersion??0,clientRequestId:randomUUID(),...body};
}
module.exports={assignmentFixture};
