// Legacy unit fixtures have no coordination requests. Not used by production or API/DB tests.
function withCoordination(db){
  if(!db||typeof db!=='object')return db;
  let proxy;
  proxy=new Proxy(db,{get(target,key){
    if(key==='$queryRaw'&&!(key in target))return async()=>[];
    if(key==='assignmentChangeRequest'&&!(key in target))return{findFirst:async()=>null,findMany:async()=>[]};
    if(key==='internalNotification'&&!(key in target))return{createMany:async({data})=>({count:data.length})};
    if(key==='$transaction')return(fn,options)=>target.$transaction?target.$transaction(tx=>fn(withCoordination(tx)),options):fn(proxy);
    const value=target[key];return typeof value==='function'?value.bind(target):value;
  }});
  return proxy;
}
module.exports={withCoordination};
