// Legacy unit fixtures have no coordination requests and an interest-rate band covering 0–100%. Not used by production or API/DB tests.
const OPEN_BAND={id:'band-open',loanType:'VAY_VON_LUU_DONG',minRate:'0',maxRate:'100',effectiveFrom:new Date('2026-01-01T00:00:00+07:00'),basis:'Khung thử nghiệm'};
function withCoordination(db){
  if(!db||typeof db!=='object')return db;
  let proxy;
  proxy=new Proxy(db,{get(target,key){
    if(key==='$queryRaw'&&!(key in target))return async()=>[];
    if(key==='assignmentChangeRequest'&&!(key in target))return{findFirst:async()=>null,findMany:async()=>[]};
    if(key==='internalNotification'&&!(key in target))return{createMany:async({data})=>({count:data.length})};
    if(key==='interestRateBand'&&!(key in target))return{findFirst:async()=>OPEN_BAND};
    if(key==='$transaction')return(fn,options)=>target.$transaction?target.$transaction(tx=>fn(withCoordination(tx)),options):fn(proxy);
    const value=target[key];return typeof value==='function'?value.bind(target):value;
  }});
  return proxy;
}
module.exports={withCoordination,OPEN_BAND};
