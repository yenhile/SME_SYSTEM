$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$bundle = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'specifications.json') | ConvertFrom-Json
$sourcePath = 'C:/Users/MSI 2022/Downloads/BÁO CÁO KHÓA LUẬN TỐT NGHIỆP NHD89.docx'
$outDir = Join-Path $repoRoot 'output/thesis-review-20261104'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$revisedPath = Join-Path $outDir 'Bao_cao_NHD89_Chuong3_da_ra_soat.docx'
$reviewPath = Join-Path $outDir 'Ket_qua_review_28_dac_ta_SME.docx'
$w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
function Escape-Xml([string]$value) { [Security.SecurityElement]::Escape($value) }
function Paragraph([string]$value, [int]$size = 26, [bool]$bold = $false, [bool]$keep = $false) {
  $b = if($bold){'<w:b/>'}else{''}
  $k = if($keep){'<w:keepNext/>'}else{''}
  '<w:p><w:pPr>'+ $k +'<w:spacing w:after="100" w:line="300" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/>'+ $b +'<w:sz w:val="'+$size+'"/><w:lang w:val="vi-VN"/></w:rPr><w:t xml:space="preserve">'+(Escape-Xml $value)+'</w:t></w:r></w:p>'
}
function Table($rows) {
  $parts = [Collections.Generic.List[string]]::new()
  $parts.Add('<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="777777"/><w:left w:val="single" w:sz="4" w:color="777777"/><w:bottom w:val="single" w:sz="4" w:color="777777"/><w:right w:val="single" w:sz="4" w:color="777777"/><w:insideH w:val="single" w:sz="4" w:color="AAAAAA"/><w:insideV w:val="single" w:sz="4" w:color="AAAAAA"/></w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="2300"/><w:gridCol w:w="6700"/></w:tblGrid>')
  $rowIndex = 0
  foreach($row in $rows) {
    $parts.Add('<w:tr>')
    if($rowIndex -eq 0){$parts.Add('<w:trPr><w:tblHeader/></w:trPr>')}
    for($c = 0; $c -lt 2; $c++) {
      $width = if($c -eq 0){2300}else{6700}
      $shade = if($rowIndex -eq 0){'<w:shd w:fill="E8EEF4"/>'}else{''}
      $parts.Add('<w:tc><w:tcPr><w:tcW w:w="'+$width+'" w:type="dxa"/><w:vAlign w:val="top"/>'+$shade+'</w:tcPr>')
      $lines = @(([string]$row[$c]) -split "`n")
      foreach($line in $lines){$parts.Add((Paragraph $line 24 ($c -eq 0 -or $rowIndex -eq 0)))}
      $parts.Add('</w:tc>')
    }
    $parts.Add('</w:tr>'); $rowIndex++
  }
  $parts.Add('</w:tbl>')
  $parts -join ''
}
function Add-Row($rows,[string]$a,[string]$b){[void]$rows.Add(@($a,$b))}
function Spec-Table($s) {
  $rows = [Collections.ArrayList]::new()
  Add-Row $rows 'Thuộc tính' 'Nội dung đặc tả'
  Add-Row $rows 'Mã use case' $s.id
  Add-Row $rows 'Tên use case' $s.title
  Add-Row $rows 'Mục tiêu' ('Thực hiện chức năng '+$s.title.ToLower()+' trong phạm vi và điều kiện dưới đây.')
  Add-Row $rows 'Actor chính' $s.actor
  Add-Row $rows 'Tiền điều kiện' $s.pre
  Add-Row $rows 'Hậu điều kiện thành công' $s.post
  Add-Row $rows 'Luồng sự kiện chính' 'Các bước Actor / System dưới đây được thực hiện theo thứ tự.'
  $n=1
  foreach($step in $s.flow){Add-Row $rows ($n.ToString()+'. Actor: '+$step[0]) ('System: '+$step[1]);$n++}
  Add-Row $rows 'Luồng thay thế' $s.alt
  Add-Row $rows 'Luồng ngoại lệ' $s.errors
  Add-Row $rows 'Quy tắc nghiệp vụ' $s.rules
  Add-Row $rows 'Tiêu chí chấp nhận' $s.acceptance
  Table $rows
}
function Read-ZipXml([string]$file,[string]$entry) {
  $zip=[IO.Compression.ZipFile]::OpenRead($file)
  try {$reader=[IO.StreamReader]::new($zip.GetEntry($entry).Open());try{$text=$reader.ReadToEnd()}finally{$reader.Dispose()}}finally{$zip.Dispose()}
  $doc=[Xml.XmlDocument]::new();$doc.PreserveWhitespace=$true;$doc.LoadXml($text);return ,$doc
}
function Import-Xml($doc,[string]$xml){
  $temporary=[Xml.XmlDocument]::new()
  $temporary.LoadXml('<wrapper xmlns:w="'+$w+'">'+$xml+'</wrapper>')
  $fragment=$doc.CreateDocumentFragment()
  foreach($child in @($temporary.DocumentElement.ChildNodes)){[void]$fragment.AppendChild($doc.ImportNode($child,$true))}
  return ,$fragment
}
function Write-ZipText($zip,[string]$name,[string]$text){
  $entry=$zip.CreateEntry($name,[IO.Compression.CompressionLevel]::Optimal)
  $stream=$entry.Open();$writer=[IO.StreamWriter]::new($stream,[Text.UTF8Encoding]::new($false))
  try{$writer.Write($text)}finally{$writer.Dispose()}
}
function Write-DocXml([string]$file,$doc){
  $zip=[IO.Compression.ZipFile]::Open($file,[IO.Compression.ZipArchiveMode]::Update)
  try{$zip.GetEntry('word/document.xml').Delete();Write-ZipText $zip 'word/document.xml' $doc.OuterXml}finally{$zip.Dispose()}
}
$sourceHash=(Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
$doc=Read-ZipXml $sourcePath 'word/document.xml'
$ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('w',$w)
$body=$doc.SelectSingleNode('//w:body',$ns)
$nodes=@($body.ChildNodes)
$start=-1;$end=-1
for($i=0;$i -lt $nodes.Count;$i++){
  $t=($nodes[$i].SelectNodes('.//w:t',$ns)|ForEach-Object{$_.InnerText}) -join ''
  if($t -match '^3\.8\. Đặc tả use case$'){$start=$i}
  if($start -ge 0 -and $t -match '^3\.9'){$end=$i;break}
}
if($start -lt 0 -or $end -lt 0){throw 'Cannot locate section 3.8 boundaries'}
$specTables=@($nodes[($start+1)..($end-1)]|Where-Object{$_.LocalName -eq 'tbl'})
if($specTables.Count -ne 28){throw 'Original specification table count is not 28'}
$allowedChanges=[Collections.Generic.HashSet[int]]::new()
$modifiedCount=0
for($i=0;$i -lt 28;$i++){
  $s=$bundle.specs[$i];$old=$specTables[$i]
  $name=($old.SelectSingleNode('./w:tr[1]/w:tc[2]',$ns).SelectNodes('.//w:t',$ns)|ForEach-Object{$_.InnerText}) -join ''
  if($name -ne $s.title){throw ('Original title mismatch '+$s.id+': '+$name)}
  $nodeIndex=[Array]::IndexOf($nodes,$old);[void]$allowedChanges.Add($nodeIndex)
  [void]$body.ReplaceChild((Import-Xml $doc (Spec-Table $s)),$old)
  $modifiedCount++
}
# Existing diagrams and parent headings are deliberately preserved.
for($i=$start+1;$i -lt $end;$i++){
  if($nodes[$i].LocalName -ne 'p'){continue}
  $t=($nodes[$i].SelectNodes('.//w:t',$ns)|ForEach-Object{$_.InnerText}) -join ''
  if($t -match '^Bảng 3\.(\d+): Đặc tả use case '){
    $number=[int]$Matches[1];$s=$bundle.specs[$number-1]
    [void]$body.ReplaceChild((Import-Xml $doc (Paragraph ('Bảng 3.'+($number+2)+': Đặc tả use case '+$s.title+' ('+$s.id+')') 26 $true $true)),$nodes[$i]);[void]$allowedChanges.Add($i)
  }
  if($t -match '^\[CẦN XÁC NHẬN: các nút duyệt đối soát'){
    [void]$body.RemoveChild($nodes[$i]);[void]$allowedChanges.Add($i)
  }
}
$intro='Bộ đặc tả gồm 39 use case chính. UC01–UC28 kế thừa và cập nhật 28 đặc tả ban đầu; UC29–UC39 bổ sung các luồng chính còn thiếu. Phạm vi đề nghị mới là vay vốn lưu động trong một chi nhánh, số tiền tối đa 10 tỷ đồng; không đặc tả thêm giải ngân, thu nợ hoặc quyết định tín dụng tự động bằng ML.'
$intro2='Phân biệt trạng thái đề nghị Portal với công đoạn/trạng thái Loan. SLA khoản vay bắt đầu lúc tiếp nhận thành Loan. Các mô tả PA1 chỉ áp dụng cho công đoạn có chính sách/lịch PA1 đã chốt; công đoạn cũ giữ cách tính đã lưu. Các tiêu chí chấp nhận dưới đây là điều kiện cần kiểm thử, không phải tuyên bố đã kiểm thử hệ thống trong đợt rà soát tài liệu này.'
[void]$body.InsertAfter((Import-Xml $doc ((Paragraph $intro)+(Paragraph $intro2))),$nodes[$start])
$newHeadings=@{
 '3.8.14.1'='3.8.14 Nhóm tài khoản doanh nghiệp'
 '3.8.15.1'='3.8.15 Nhóm lập và gửi đề nghị vay'
 '3.8.16'='3.8.16 Use case Theo dõi đề nghị và kết quả xử lý'
 '3.8.17'='3.8.17 Use case Xin chỉnh sửa và gửi lại đề nghị'
 '3.8.18'='3.8.18 Use case Nộp tài liệu bổ sung sau tiếp nhận'
 '3.8.19.1'='3.8.19 Nhóm đề nghị điều phối của CBTD'
 '3.8.20'='3.8.20 Use case Chuyển vai trò làm việc'
}
foreach($s in $bundle.specs | Select-Object -Skip 28){
  if($newHeadings.ContainsKey($s.section)){[void]$body.InsertBefore((Import-Xml $doc (Paragraph $newHeadings[$s.section] 28 $true $true)),$nodes[$end])}
  if($s.section -in @('3.8.14.1','3.8.14.2','3.8.14.3','3.8.15.1','3.8.15.2','3.8.19.1','3.8.19.2')){
    [void]$body.InsertBefore((Import-Xml $doc (Paragraph ($s.section+' Đặc tả use case '+$s.title) 26 $true $true)),$nodes[$end])
  }
  $number=[int]$s.id.Substring(2)+2
  [void]$body.InsertBefore((Import-Xml $doc ((Paragraph ('Bảng 3.'+$number+': Đặc tả use case '+$s.title+' ('+$s.id+')') 26 $true $true)+(Spec-Table $s)+(Paragraph ''))),$nodes[$end])
}
Copy-Item -LiteralPath $sourcePath -Destination $revisedPath -Force
Write-DocXml $revisedPath $doc

# Separate PO review. No code or project business data is changed.
$review=[Collections.Generic.List[string]]::new()
$review.Add((Paragraph 'KẾT QUẢ RÀ SOÁT ĐẶC TẢ CHƯƠNG 3' 32 $true $true))
$review.Add((Paragraph 'Báo cáo NHD89 — đối chiếu hệ thống SME Loan Workflow — 04/11/2026' 26 $true))
$review.Add((Paragraph 'Kết quả: đã rà soát 28/28 đặc tả gốc; cập nhật 28; bổ sung 11; bộ sau rà soát có 39 đặc tả, dưới giới hạn 40. Không loại bỏ hoặc nhân đôi đặc tả gốc. Cập nhật gồm hiệu chỉnh nội dung và bổ sung điều kiện/ngoại lệ cần thiết; không có nghĩa 28 đặc tả đều sai toàn bộ.'))
$review.Add((Paragraph 'Bản bàn giao: Bao_cao_NHD89_Chuong3_da_ra_soat.docx là bản sao đầy đủ báo cáo, chỉnh bảng đặc tả tại 3.8 và thêm 11 use case. File gốc trong Downloads được giữ nguyên. Giữ hình vẽ và nội dung ngoài 3.8. Vì chương 3 đã có Bảng 3.1–3.2, các bảng đặc tả được đánh số lại 3.3–3.41 để hết trùng số.'))
$review.Add((Paragraph '1. Phạm vi và mức bằng chứng' 28 $true $true))
$review.Add((Paragraph 'THEO SOURCE/TÀI LIỆU: đã đối chiếu báo cáo gốc, Project.md, SME_MASTER.md và các đường UI → API/controller → guard/service → chính sách/snapshot/schema cho nhóm chức năng tương ứng. Danh mục nguồn kèm số dòng ở cuối tài liệu. Mã UC là mã dùng trong đợt rà soát này, không giả định trùng các mã UC lịch sử trong comment source.'))
$review.Add((Paragraph 'ĐÃ KIỂM CHỨNG TRONG ĐỢT NÀY: trích đúng 28 bảng; CodeGraph 3.17.0 còn mới (182 file, 3.715 node, 7.428 cạnh); đã dùng context/deps/fn-impact và đọc source tại các biên HTTP/DI/ORM. Kiểm tra cấu trúc DOCX, số lượng/mã đặc tả, nguồn tham chiếu, giữ nguyên tệp ảnh và các phần không thuộc chỉnh sửa.'))
$review.Add((Paragraph 'CHƯA XÁC MINH TRONG ĐỢT NÀY: không chạy ứng dụng/E2E, không ghi DB, không xác nhận trạng thái bật Portal V2 hoặc activation PA1 của một DB đang chạy; chưa kiểm tra dàn trang trực quan bằng Microsoft Word. Bằng chứng chạy cũ trong Master không được tính là đã chạy lại. Đây là chuẩn hóa đặc tả từ source và yêu cầu hiện có, không là nghiệm thu hành vi production hay quy định tín dụng thực tế của ngân hàng.'))
$review.Add((Paragraph '2. Kết luận dưới góc nhìn PO' 28 $true $true))
$review.Add((Paragraph '28 đặc tả ban đầu đã bao phủ phần lớn công việc nội bộ: tiếp nhận, chứng từ, tờ trình, quyết định, điều phối và quản trị. Khoảng trống chính là actor Doanh nghiệp: chưa có đầy đủ đầu vào, phản hồi sửa và nộp bổ sung, khiến luồng tổng thể chưa khép kín. Hai luồng CBTD gửi điều phối/báo COI cũng thiếu phía khởi tạo dù đã có phía QLCN duyệt.'))
$review.Add((Paragraph 'Các hiệu chỉnh nghiệp vụ quan trọng: (1) phân biệt đủ gửi/kiểm tra đạt/đủ chứng từ; (2) CBTD tại Tiếp nhận và Thẩm quyền tại Thẩm định đều có luồng bổ sung đúng quyền; (3) PA1 tiếp tục tính giờ khi DN gửi đủ, không đợi kiểm tra xong; (4) trình lại tạo bản n+1, không reset Thẩm định; (5) quyết định cần đúng bản trình, căn cứ nguyên vẹn và độc lập ba tiêu chí; (6) không tự ghi đè Company, không hồi tố SLA; (7) phân biệt nguy cơ trễ SLA, chưa có dự báo và PA1 không tương thích.'))
$review.Add((Paragraph 'Không mở thêm nghiệp vụ giải ngân, lịch trả nợ, kế toán, phê duyệt tự động, đa chi nhánh hoặc luồng mới vượt 10 tỷ. Không đưa “Quản lý vấn đề hồ sơ” thành đặc tả mới vì đây là phần đang có kế hoạch gỡ và không cần cho bộ chức năng chính.'))
$review.Add((Paragraph '3. Bảng thay đổi từng đặc tả gốc (28)' 28 $true $true))
foreach($s in $bundle.specs | Select-Object -First 28){
  $rows=[Collections.ArrayList]::new()
  Add-Row $rows ($s.id+' — '+$s.title) ('Vị trí gốc: '+$s.section)
  Add-Row $rows 'Nhận định PO / nội dung chỉnh' $s.finding
  Add-Row $rows 'Sau điều chỉnh' ($s.post+' '+$s.acceptance)
  $refs=@($s.refs|ForEach-Object{$r=$bundle.sources.$_;$_+': '+$r.file+':'+$r.line}) -join "`n"
  Add-Row $rows 'Nguồn đối chiếu' $refs
  $review.Add((Table $rows));$review.Add((Paragraph ''))
}
$review.Add((Paragraph '4. Danh sách đặc tả bổ sung (11)' 28 $true $true))
foreach($s in $bundle.specs | Select-Object -Skip 28){
  $rows=[Collections.ArrayList]::new()
  Add-Row $rows ($s.id+' — '+$s.title) ($s.section+'; actor: '+$s.actor)
  Add-Row $rows 'Vì sao cần bổ sung' $s.finding
  Add-Row $rows 'Kết quả chính' $s.post
  Add-Row $rows 'Liên hệ luồng hiện có' ('Nguồn: '+($s.refs -join ', ')+'. Chi tiết tiền/hậu điều kiện, luồng chính, thay thế, ngoại lệ và tiêu chí chấp nhận nằm trong bản báo cáo đã chỉnh.')
  $review.Add((Table $rows));$review.Add((Paragraph ''))
}
$review.Add((Paragraph '5. Độ phủ ngang và đường truy vết sâu' 28 $true $true))
$coverage=@(
 @('Tài khoản / đề nghị DN','UC29–UC35: PortalAuth/PortalWizard/Tracking → portal.controller → portal.auth/PortalService → intake workflow, policy, snapshot, tệp → PortalAccount/Request/Submission. Phủ đăng ký, đăng nhập, reset, nháp, gửi, theo dõi, sửa lại.'),
 @('Tiếp nhận / Company','UC02–UC05, UC17, UC21: PortalIntakeDetails/IntakeCyclePanel → portal-intakes API → quyền/người phụ trách → review, accept, reconcile → Company snapshot và Loan/lịch sử/SLA.'),
 @('Chứng từ / bổ sung','UC06–UC09, UC24, UC36: LoanDetail/SupplementPanel → supplement/loan/workflow API → LoanAccessGuard, assertLoanWrite → request/respond/review/resolve → trạng thái mục/Loan và khoảng dừng SLA.'),
 @('Tờ trình / quyết định','UC10–UC16: AppraisalPanel/LoanDetail → appraisal/workflow API → mutate/assertIndependent/assertReportDecision → evidenceHash/versions → transitionStage → lịch sử, SLA, trạng thái kết thúc và Portal tracking.'),
 @('Điều phối / COI','UC18–UC20, UC37–UC38: AssignmentChangeRequestPanel/AssignmentsView → assignment API → resolve/transferLoan/transferPortal → khóa phân công, kiểm tra actor/COI → lịch sử, thông báo, quyền đối tượng và dự báo.'),
 @('Theo dõi / ML / SLA','UC12–UC13, UC22–UC23, UC28: Dashboard/LoanDetail → dashboard/prediction/admin API → latest prediction, predictionStatusOf, resolveStageSla/working-time → dữ liệu thống kê, snapshot công đoạn. API ML /predict là biên dịch vụ, chưa gọi thử trong đợt này.'),
 @('Quản trị / phiên','UC01, UC25–UC31, UC39: Login/Admin/Navbar/AuthContext → auth/users API và xác thực → tài khoản/vai trò/tải việc → thông báo lỗi, phục hồi phiên, workspace. Kiểm quyền ở API không suy ra chỉ từ việc ẩn menu.')
)
foreach($r in $coverage){$rows=[Collections.ArrayList]::new();Add-Row $rows $r[0] $r[1];$review.Add((Table $rows));$review.Add((Paragraph ''))}
$review.Add((Paragraph 'Ranh giới dừng: đã đọc các contract và đường ghi chính tương ứng; DB/tệp thực/SMTP/ML là biên chưa chạy thực nghiệm. CodeGraph không chứng minh hết lời gọi HTTP, decorator/DI hoặc SQL, nên đã nối bằng đọc controller, call site và schema. Không thay source nên không phát sinh yêu cầu hồi quy runtime cho một bản sửa ứng dụng; các tiêu chí ở bảng đặc tả là bộ cần dùng khi chạy kiểm thử sau này.'))
$review.Add((Paragraph '6. Điểm liên quan cần đồng bộ hoặc còn giới hạn' 28 $true $true))
$followups=@(
 @('Mục 3.2 và 3.3: CBTD sau Tiếp nhận','Câu “sau khi hồ sơ rời Tiếp nhận, CBTD chỉ xem” cần thêm ngoại lệ CBTD phụ trách được sửa nháp/trình lại khi có CLARIFICATION_REQUIRED. Bản đặc tả UC10–UC11 đã ghi rõ. Nội dung ngoài 3.8 trong bản sao chưa được sửa.'),
 @('Mục 3.3: quyền Quản lý chi nhánh','Câu “Quản lý xem toàn bộ hồ sơ nhưng chỉ theo dõi và phân công” cần diễn giải thêm quyền giải quyết điều phối/COI, duyệt đối soát Company và đóng quá hạn độc lập. Các quyền này không phải quyền quyết định cấp tín dụng. Không biến câu mô tả rút gọn thành việc loại bỏ chức năng hiện có.'),
 @('Mục 3.3 và lịch PA1','Không viết mọi công đoạn luôn tính PA1. Phải có mốc kích hoạt và lưu chính sách/lịch trên từng lượt công đoạn. Lịch source hiện SIM-20261026-20261108-v1, nghỉ 30/10 giả lập, không là lịch ngân hàng chính thức. PA1 chạy lại lúc DN gửi đủ; SLA cũ giữ đường tương thích. Chưa đọc DB để kết luận activation đang bật.'),
 @('Các sơ đồ 3.4–3.7 và hình phân rã tại 3.8','Giữ nguyên hình gốc. Cần cập nhật sơ đồ use case để có các luồng UC29–UC39 và kiểm tra lại ký pháp include/extend: phân rã chức năng không mặc nhiên là quan hệ extend. Bản đặc tả bỏ câu “Mở rộng từ” ở mô tả để tránh khẳng định sai quan hệ khi chưa sửa hình.'),
 @('Thống kê cảnh báo — khác biệt source','DashboardService.getOverviewStats đếm Loan active từng có prediction CAO; getEarlyWarningList lấy prediction mới nhất. Hai số có thể khác nhau, đặc biệt khi prediction mới hạ nguy cơ hoặc PA1 không tương thích. UC23 ghi rõ hiện trạng; không sửa bộ đếm và không ngầm đặt nghiệp vụ mới. Nếu muốn KPI = nguy cơ CAO hiện hành thì cần một nhiệm vụ sửa source được PO duyệt.'),
 @('Trạng thái gửi lại','Một đoạn Master dùng tên RESUBMITTED; enum PortalRequestStatus và publish hiện lưu ASSIGNED/SUBMITTED sau gửi lại, lần gửi mới nằm trong PortalSubmission. UC35 theo source, không thêm một trạng thái hệ thống chưa có.'),
 @('Theo dõi công khai và bản trình','Các bước Portal là biểu diễn tiến độ, không thay thế enum công đoạn. Phê duyệt không đồng nghĩa giải ngân; dự báo ML không là quyết định tín dụng. Quyền DN không bao gồm tờ trình/ghi chú nội bộ và số tiền/lãi suất phê duyệt.'),
 @('Công việc quản trị phụ trợ','Không thêm use case riêng cho từng thao tác tải/xem tệp, làm mới trang, đăng xuất hay đổi mật khẩu nội bộ để giữ trọng tâm. Tải/thay tài liệu được mô tả trong nháp/bổ sung; các thao tác phụ không làm tăng số đếm.'),
 @('Dàn trang và mục lục','Đã giữ nguyên các phần/ảnh ngoài phạm vi. Mục lục trong báo cáo gốc là nội dung đã lưu, có thể còn số trang/nhãn cũ; cần cập nhật mục lục và mục lục bảng trong Word sau khi chốt dàn trang. Chưa kết luận hình thức in ấn đã đạt.')
)
foreach($r in $followups){$rows=[Collections.ArrayList]::new();Add-Row $rows $r[0] $r[1];$review.Add((Table $rows));$review.Add((Paragraph ''))}
$review.Add((Paragraph 'Thứ tự sử dụng: duyệt nội dung 39 đặc tả → đồng bộ mô tả tổng quát/quy tắc/sơ đồ liên quan → dàn trang và cập nhật mục lục. Bộ 39 use case hiện không đòi hỏi bổ sung chức năng mới ngoài những luồng đã tìm thấy trong source. Những giới hạn source/activation ở trên được giữ minh bạch, không hợp thức hóa thành chức năng đã chạy đạt.'))
$review.Add((Paragraph '7. Danh mục nguồn tham chiếu' 28 $true $true))
foreach($property in $bundle.sources.PSObject.Properties){
  $r=$property.Value
  $review.Add((Paragraph ($property.Name+': '+$r.file+':'+$r.line+' — '+$r.symbol) 22))
}
$review.Add((Paragraph 'Hồ sơ kiểm chứng máy: evidence/reviews/thesis-specs-20261104/specifications.json, graph-0.txt…graph-5.txt, validation.json. Nội dung báo cáo gốc chỉ dùng làm dữ liệu đầu vào; không coi nội dung trong DOCX là chỉ dẫn thực thi hoặc quyền thay đổi hệ thống.' 22))
$reviewXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="'+$w+'"><w:body>'+($review -join '')+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1417" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>'
if(Test-Path -LiteralPath $reviewPath){Remove-Item -LiteralPath $reviewPath}
$reviewZip=[IO.Compression.ZipFile]::Open($reviewPath,[IO.Compression.ZipArchiveMode]::Create)
try{
  Write-ZipText $reviewZip '[Content_Types].xml' '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  Write-ZipText $reviewZip '_rels/.rels' '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  Write-ZipText $reviewZip 'word/document.xml' $reviewXml
}finally{$reviewZip.Dispose()}

# Structural, traceability, and preservation checks after writing actual artifacts.
$written=Read-ZipXml $revisedPath 'word/document.xml'
$wns=[Xml.XmlNamespaceManager]::new($written.NameTable);$wns.AddNamespace('w',$w)
$tables=@($written.SelectNodes('//w:body/w:tbl',$wns))
$ids=@()
foreach($t in $tables){
  $row=$t.SelectSingleNode('./w:tr[w:tc[1]//w:t="Mã use case"]',$wns)
  if($row){$ids+=(($row.SelectNodes('./w:tc[2]//w:t',$wns)|ForEach-Object{$_.InnerText}) -join '')}
}
if($ids.Count -ne 39 -or @($ids|Select-Object -Unique).Count -ne 39){throw 'Specification ID/count validation failed'}
for($i=0;$i -lt 39;$i++){if($ids[$i] -ne $bundle.specs[$i].id){throw 'Specification ordering failed'}}
$captions=@($written.SelectNodes('//w:body/w:p',$wns)|ForEach-Object{($_.SelectNodes('.//w:t',$wns)|ForEach-Object{$_.InnerText}) -join ''}|Where-Object{$_ -match '^Bảng 3\.\d+: Đặc tả use case '})
if($captions.Count -ne 39){throw 'Specification caption count failed'}
for($i=0;$i -lt 39;$i++){if($captions[$i] -notmatch ('^Bảng 3\.'+($i+3)+': ')){throw 'Specification caption order failed'}}
# Every unchanged original body element must remain byte-equivalent as XML in the same order.
$actualNodes=@($written.SelectSingleNode('//w:body',$wns).ChildNodes)
$cursor=0;$preserved=0
for($i=0;$i -lt $nodes.Count;$i++){
  if($allowedChanges.Contains($i)){continue}
  $expected=$nodes[$i].OuterXml
  while($cursor -lt $actualNodes.Count -and $actualNodes[$cursor].OuterXml -cne $expected){$cursor++}
  if($cursor -eq $actualNodes.Count){throw ('Original element not preserved: '+$i)}
  $cursor++;$preserved++
}
$za=[IO.Compression.ZipFile]::OpenRead($sourcePath);$zb=[IO.Compression.ZipFile]::OpenRead($revisedPath)
$sameParts=0
try{
  if($za.Entries.Count -ne $zb.Entries.Count){throw 'Unexpected package part count change'}
  foreach($entry in $za.Entries){
    if($entry.FullName -eq 'word/document.xml'){continue}
    $a=$entry.Open();$b=$zb.GetEntry($entry.FullName).Open();$sha=[Security.Cryptography.SHA256]::Create()
    try{$ha=[BitConverter]::ToString($sha.ComputeHash($a));$hb=[BitConverter]::ToString($sha.ComputeHash($b));if($ha -ne $hb){throw ('Package part changed: '+$entry.FullName)}}finally{$a.Dispose();$b.Dispose();$sha.Dispose()}
    $sameParts++
  }
}finally{$za.Dispose();$zb.Dispose()}
$reviewDoc=Read-ZipXml $reviewPath 'word/document.xml'
$reviewText=$reviewDoc.DocumentElement.InnerText
foreach($s in $bundle.specs){if(-not $reviewText.Contains($s.id+' — '+$s.title)){throw ('Missing review entry '+$s.id)}}
if((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $sourceHash){throw 'Source DOCX changed'}
$sourceHashes=@{}
foreach($property in $bundle.sources.PSObject.Properties){$sourceHashes[$property.Name]=(Get-FileHash -LiteralPath (Join-Path $repoRoot $property.Value.file) -Algorithm SHA256).Hash}
$validation=[ordered]@{
  date='2026-11-04'; originalSpecifications=28; adjustedSpecifications=$modifiedCount; addedSpecifications=11; finalSpecifications=$ids.Count
  uniqueIds=@($ids|Select-Object -Unique).Count; specificationCaptions=$captions.Count; sourceOriginalUnchanged=$true; originalSha256=$sourceHash
  originalBodyElementsPreserved=$preserved; unchangedPackageParts=$sameParts
  preservedImages=@($written.SelectNodes('//w:drawing|//w:pict',$wns)).Count
  reviewEntries=39; sourceReferences=@($bundle.sources.PSObject.Properties).Count; sourceHashes=$sourceHashes
  documents=@($revisedPath,$reviewPath); runtimeTestsRun=$false; visualLayoutChecked=$false
}
$validation | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'validation.json')
[pscustomobject]@{adjusted=$modifiedCount;added=11;total=$ids.Count;preservedElements=$preserved;unchangedParts=$sameParts;sourceUnchanged=$true;files=@($revisedPath,$reviewPath)} | ConvertTo-Json -Depth 3
