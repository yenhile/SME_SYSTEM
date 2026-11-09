import { currentStagePrediction } from '../prediction/prediction-status';
/** Display workload only. Do not reuse as a replacement for ML feature extraction. */
export async function officerWorkloads(db:any) {
  const officers=await db.user.findMany({where:{isActive:true,roles:{some:{role:{code:'CBTD'}}}},select:{id:true,fullName:true,username:true,phone:true,branchName:true,roles:{include:{role:true}}},orderBy:{fullName:'asc'}});
  return Promise.all(officers.map(async(officer:any)=>{
    const loans=await db.loanApplication.findMany({where:{assignedTo:officer.id,completedAt:null,currentStage:{not:'HOAN_TAT'},currentStatus:{in:['RECEIVED','CHECKED','SUPPLEMENT_REQUIRED','PENDING_APPRAISAL']}},select:{id:true,currentStage:true,delayPredictions:{orderBy:[{predictionTimestamp:'desc'},{id:'desc'}],take:1,select:{riskLevel:true,modelVersion:true,predictionTimestamp:true}},stageHistories:{where:{exitedAt:null},select:{enteredAt:true},take:1}}});
    const pendingIntakeCount=await db.portalRequest.count({where:{assignedTo:officer.id,status:{in:['ASSIGNED','RETURNED']}}});
    const activeLoanCount=loans.length,totalAssignedCount=activeLoanCount+pendingIntakeCount;
    return{...officer,roles:officer.roles.map((r:any)=>r.role.code),activeLoanCount,pendingIntakeCount,totalAssignedCount,highRiskLoanCount:loans.filter((l:any)=>(currentStagePrediction(l.delayPredictions,l.currentStage,l.stageHistories[0]) as any)?.riskLevel==='CAO').length,workloadStatus:totalAssignedCount>=10?'QUÁ TẢI':totalAssignedCount>=6?'BẬN RỘN':'KHẢ DỤNG'};
  })).then(rows=>rows.sort((a,b)=>a.totalAssignedCount-b.totalAssignedCount||a.id.localeCompare(b.id)));
}
