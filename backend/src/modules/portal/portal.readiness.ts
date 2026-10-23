import { validatePortalData } from './portal.validation';
export const mvpPolicy = {
  version:'sme-mvp-manufacturing-working-capital-2026-10-23-draft1',status:'PENDING',canSubmit:false,
  scope:'Mô phỏng khóa luận; không phải chính sách tín dụng ngân hàng',
  decisions:[
    {id:'company-data',status:'PO_CONFIRMED',rule:'13 trường thực, năm và nguồn doanh thu, không annualize hoặc điền giá trị giả'},
    {id:'no-annual-data',status:'PO_CONFIRMED',rule:'Chỉ lưu nháp; không phải từ chối tín dụng'},
    {id:'supplement',status:'PO_CONFIRMED',rule:'Chỉ bổ sung sau tiếp nhận; snapshot, SLA và ML giữ nguyên'},
    {id:'finance-components',status:'PENDING',rule:'Thành phần BCTC theo chế độ kế toán và kỳ áp dụng'},
    {id:'representative',status:'PENDING',rule:'Định danh, thẩm quyền ký và xác nhận điện tử'},
    {id:'alternatives',status:'PENDING',rule:'Các chứng từ C thay thế nhau, miễn/hoãn, bảo đảm và dư nợ theo sản phẩm'},
  ],
};
const required=['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address','loanPurpose','loanType','proposedAmount','loanTermMonths'];
type FileBasis={id:string;documentGroup:string;coverage?:any;withdrawnAt?:unknown;supersedesId?:string|null};
export function assessReadiness(data:Record<string,any>,documents:FileBasis[]) {
  const issues:{code:string;path:string;step:number;message:string}[]=[];
  for(const field of required) if(data[field]===undefined || data[field]===null || (typeof data[field]==='string'&&!data[field].trim())) issues.push({code:'MISSING_DATA',path:field,step:['loanPurpose','loanType','proposedAmount','loanTermMonths'].includes(field)?2:1,message:`Cần có dữ liệu thực: ${field}. Chưa đủ dữ liệu thì tiếp tục lưu nháp.`});
  try{validatePortalData(Object.fromEntries(required.filter(k=>data[k]!==undefined).map(k=>[k,data[k]])),true);}catch(error){if(!issues.length) issues.push({code:'INVALID_DATA',path:'data',step:1,message:(error as Error).message});}
  const year=typeof data.revenuePeriod==='string'&&/^[1-9]\d{3}$/.test(data.revenuePeriod)?Number(data.revenuePeriod):null;
  if(!year || year>new Date().getFullYear() || (typeof data.establishedYear==='number'&&year<data.establishedYear)) issues.push({code:'ANNUAL_PERIOD',path:'revenuePeriod',step:1,message:'Cần kỳ doanh thu năm YYYY phù hợp năm thành lập. Không dùng kỳ quý/tháng hoặc tự quy đổi doanh thu.'});
  const superseded=new Set(documents.map(d=>d.supersedesId).filter(Boolean));
  const source=documents.find(d=>d.id===data.annualRevenueBasis?.documentId&&!d.withdrawnAt&&!superseded.has(d.id)&&d.documentGroup==='B'&&Array.isArray(d.coverage)&&d.coverage.some((c:any)=>c.documentTypeCode==='B_FINANCIAL_STATEMENTS'&&c.period===data.revenuePeriod));
  if(!source || data.annualRevenueBasis?.fullYearCompleted!==true) issues.push({code:'ANNUAL_SOURCE',path:'annualRevenueBasis',step:4,message:'Chọn BCTC có metadata đúng năm và xác nhận kỳ năm đã hoàn thành. Nếu chưa có dữ liệu năm, chỉ lưu nháp; đây không phải từ chối tín dụng.'});
  return {version:'MVP1',policyVersion:mvpPolicy.version,dataReady:issues.length===0,canSubmit:false,creditDecision:null,issues,annualSourceIds:source?[source.id]:[],note:'Kiểm tra dữ liệu sẵn sàng, không xác nhận tài liệu hợp lệ hoặc đủ thành phần BCTC; policy vẫn PENDING.'};
}
export function companyReadiness(data:Record<string,any>,company:Record<string,any>) {
  const differences=['industry','establishedYear','annualRevenue','charterCapital'].filter(k=>['annualRevenue','charterCapital'].includes(k)?Number(company[k])!==data[k]:company[k]!==data[k]);
  return {compatible:differences.length===0,requiresConfirmation:true,differences,annualPeriod:data.revenuePeriod??null,message:differences.length?'Dữ liệu tài chính/ngành/năm thành lập khác Company hiện hữu. Cần đối chiếu theo quyền cập nhật riêng; hệ thống không tự ghi đè.':'Company chưa lưu kỳ tài chính; CBTD phải đối chiếu độ cập nhật và nguồn trước khi xác nhận tiếp nhận.'};
}
