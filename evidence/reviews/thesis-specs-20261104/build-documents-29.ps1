$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$bundle=Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'specifications-29.json') | ConvertFrom-Json
$outDir=Join-Path $repoRoot 'output/thesis-review-20261104'
$standalone=Join-Path $outDir 'Dac_ta_29_UseCase_SME_theo_mau.docx'
$integrated=Join-Path $outDir 'Bao_cao_NHD89_muc_3_8_29_dac_ta.docx'
$source='C:/Users/MSI 2022/Downloads/BÁO CÁO KHÓA LUẬN TỐT NGHIỆP NHD89.docx'
$w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
$sourceHash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
function Escape-Xml([string]$value){[Security.SecurityElement]::Escape($value)}
function P([string]$value,[bool]$bold=$false,[string]$align='left',[bool]$keep=$false,[int]$size=26,[bool]$pageBreak=$false){
 $b=if($bold){'<w:b/>'}else{''};$k=if($keep){'<w:keepNext/>'}else{''};$pb=if($pageBreak){'<w:pageBreakBefore/>'}else{''}
 '<w:p><w:pPr>'+ $k+$pb+'<w:jc w:val="'+$align+'"/><w:spacing w:before="0" w:after="60" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/>'+$b+'<w:sz w:val="'+$size+'"/><w:lang w:val="vi-VN"/></w:rPr><w:t xml:space="preserve">'+(Escape-Xml $value)+'</w:t></w:r></w:p>'
}
function Table($spec){
 $parts=[Collections.Generic.List[string]]::new()
 $parts.Add('<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="000000"/><w:left w:val="single" w:sz="6" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:color="000000"/><w:right w:val="single" w:sz="6" w:color="000000"/><w:insideH w:val="single" w:sz="6" w:color="000000"/><w:insideV w:val="single" w:sz="6" w:color="000000"/></w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar><w:tblCaption w:val="'+$spec.id+'"/></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid>')
 foreach($row in $spec.rows){
  $parts.Add('<w:tr><w:trPr><w:cantSplit/></w:trPr>')
  if($row.kind -eq 'section'){
   $parts.Add('<w:tc><w:tcPr><w:tcW w:w="9000" w:type="dxa"/><w:gridSpan w:val="2"/><w:shd w:val="clear" w:fill="D9D9D9"/><w:vAlign w:val="center"/></w:tcPr>'+(P $row.title $true 'center' $true 26)+'</w:tc>')
  }else{
   for($i=0;$i -lt 2;$i++){
    $bold=($row.kind -eq 'meta' -and $i -eq 0) -or $row.kind -eq 'columns'
    $align=if($row.kind -eq 'columns'){'center'}else{'left'}
    $keep=$row.kind -in @('meta','columns')
    $parts.Add('<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>'+(P $row.cells[$i] $bold $align $keep 26)+'</w:tc>')
   }
  }
  $parts.Add('</w:tr>')
 }
 $parts.Add('</w:tbl>');$parts -join ''
}
function Caption($spec,[bool]$pageBreak=$false){P ('Bảng 3.'+([int]$spec.id.Substring(2)+2)+': Đặc tả use case '+$spec.title+' ('+$spec.id+')') $false 'center' $true 26 $pageBreak}
function Read-Document([string]$file){
 $zip=[IO.Compression.ZipFile]::OpenRead($file)
 try{$reader=[IO.StreamReader]::new($zip.GetEntry('word/document.xml').Open());try{$text=$reader.ReadToEnd()}finally{$reader.Dispose()}}finally{$zip.Dispose()}
 $doc=[Xml.XmlDocument]::new();$doc.PreserveWhitespace=$true;$doc.LoadXml($text);return ,$doc
}
function Import-Xml($doc,[string]$xml){
 $temp=[Xml.XmlDocument]::new();$temp.LoadXml('<wrapper xmlns:w="'+$w+'">'+$xml+'</wrapper>')
 $fragment=$doc.CreateDocumentFragment();foreach($node in @($temp.DocumentElement.ChildNodes)){[void]$fragment.AppendChild($doc.ImportNode($node,$true))};return ,$fragment
}
function Zip-Text($zip,[string]$name,[string]$text){
 $entry=$zip.CreateEntry($name,[IO.Compression.CompressionLevel]::Optimal);$writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false))
 try{$writer.Write($text)}finally{$writer.Dispose()}
}
function Replace-Document([string]$file,$doc){
 $zip=[IO.Compression.ZipFile]::Open($file,[IO.Compression.ZipArchiveMode]::Update)
 try{$zip.GetEntry('word/document.xml').Delete();Zip-Text $zip 'word/document.xml' $doc.OuterXml}finally{$zip.Dispose()}
}
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$intro='Phần này gồm 29 đặc tả chức năng chính: 28 use case nội bộ và 1 use case Lập và gửi đề nghị vay của Doanh nghiệp.'
$intro2='Điều kiện chung: thao tác đúng vai trò và phạm vi được giao; hồ sơ kết thúc chỉ được xem. Thẩm quyền độc lập là người không phụ trách, tiếp nhận hoặc tham gia lập/trình tờ trình. SLA giữ chính sách của công đoạn; với PA1, thời gian chờ kết thúc khi DN gửi đủ tài liệu.'
$chunks=[Collections.Generic.List[string]]::new()
$chunks.Add((P '3.8. ĐẶC TẢ USE CASE' $true 'center' $true 30))
$chunks.Add((P $intro));$chunks.Add((P $intro2))
foreach($s in $bundle.specs){$chunks.Add((Caption $s ([int]$s.id.Substring(2) -gt 1)));$chunks.Add((Table $s));$chunks.Add((P ''))}
$docXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="'+$w+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'+($chunks -join '')+'<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1417" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>'
if(Test-Path -LiteralPath $standalone){Remove-Item -LiteralPath $standalone}
$zip=[IO.Compression.ZipFile]::Open($standalone,[IO.Compression.ZipArchiveMode]::Create)
try{
 Zip-Text $zip '[Content_Types].xml' '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'
 Zip-Text $zip '_rels/.rels' '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
 Zip-Text $zip 'word/_rels/document.xml.rels' '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'
 Zip-Text $zip 'word/footer1.xml' ('<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="'+$w+'"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>')
 Zip-Text $zip 'word/document.xml' $docXml
}finally{$zip.Dispose()}

# Integrate into a new copy of the ORIGINAL 28-table report, never the old 39-case draft.
$doc=Read-Document $source
$ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('w',$w)
$body=$doc.SelectSingleNode('//w:body',$ns);$nodes=@($body.ChildNodes);$start=-1;$end=-1
for($i=0;$i -lt $nodes.Count;$i++){
 $text=($nodes[$i].SelectNodes('.//w:t',$ns)|ForEach-Object{$_.InnerText}) -join ''
 if($text -match '^3\.8\. Đặc tả use case$'){$start=$i}
 if($start -ge 0 -and $text -match '^3\.9'){$end=$i;break}
}
if($start -lt 0 -or $end -lt 0){throw 'Cannot locate 3.8'}
$oldTables=@($nodes[($start+1)..($end-1)]|Where-Object{$_.LocalName -eq 'tbl'})
if($oldTables.Count -ne 28){throw 'Original table count mismatch'}
$allowed=[Collections.Generic.HashSet[int]]::new()
for($i=0;$i -lt 28;$i++){
 $s=$bundle.specs[$i];$old=$oldTables[$i]
 $oldName=($old.SelectSingleNode('./w:tr[1]/w:tc[2]',$ns).SelectNodes('.//w:t',$ns)|ForEach-Object{$_.InnerText}) -join ''
 if($oldName -ne $s.title){throw ('Original title mismatch: '+$s.id)}
 [void]$allowed.Add([Array]::IndexOf($nodes,$old));[void]$body.ReplaceChild((Import-Xml $doc (Table $s)),$old)
}
for($i=$start+1;$i -lt $end;$i++){
 if($nodes[$i].LocalName -ne 'p'){continue}
 $text=($nodes[$i].SelectNodes('.//w:t',$ns)|ForEach-Object{$_.InnerText}) -join ''
 if($text -match '^Bảng 3\.(\d+): Đặc tả use case '){
  $index=[int]$Matches[1]-1;[void]$body.ReplaceChild((Import-Xml $doc (Caption $bundle.specs[$index])),$nodes[$i]);[void]$allowed.Add($i)
 }
 if($text -match '^\[CẦN XÁC NHẬN: các nút duyệt đối soát'){
  [void]$body.ReplaceChild((Import-Xml $doc (P 'Đối soát dữ liệu doanh nghiệp là thao tác riêng của Quản lý chi nhánh; việc cập nhật dữ liệu dùng chung phải bảo toàn thông tin đã chốt của các hồ sơ vay trước.')),$nodes[$i]);[void]$allowed.Add($i)
 }
}
[void]$body.InsertAfter((Import-Xml $doc ((P $intro)+(P $intro2))),$nodes[$start])
$last=$bundle.specs[28]
[void]$body.InsertBefore((Import-Xml $doc ((P '3.8.14 Use case Lập và gửi đề nghị vay' $true 'left' $true)+(Caption $last)+(Table $last)+(P ''))),$nodes[$end])
Copy-Item -LiteralPath $source -Destination $integrated -Force
Replace-Document $integrated $doc

function Validate-Tables([string]$file){
 $x=Read-Document $file;$n=[Xml.XmlNamespaceManager]::new($x.NameTable);$n.AddNamespace('w',$w)
 $tables=@($x.SelectNodes('//w:body/w:tbl',$n)|Where-Object{
  (($_.SelectNodes('./w:tr[1]/w:tc[1]//w:t',$n)|ForEach-Object{$_.InnerText}) -join '') -eq 'Tên use case'
 })
 if($tables.Count -ne 29){throw ('Not 29 tables: '+$file)}
 for($i=0;$i -lt 29;$i++){
  $s=$bundle.specs[$i];$table=$tables[$i];$rows=@($table.SelectNodes('./w:tr',$n))
  if($rows.Count -ne $s.rows.Count){throw ('Row count mismatch '+$s.id)}
  $id=$table.SelectSingleNode('./w:tblPr/w:tblCaption/@w:val',$n).Value
  if($id -ne $s.id){throw ('ID order mismatch '+$id)}
  $stepNumber=0
  for($r=0;$r -lt $rows.Count;$r++){
   $wanted=$s.rows[$r];$row=$rows[$r];$cells=@($row.SelectNodes('./w:tc',$n))
   if($wanted.kind -eq 'section'){
    if($cells.Count -ne 1 -or $cells[0].SelectSingleNode('./w:tcPr/w:gridSpan/@w:val',$n).Value -ne '2' -or $cells[0].SelectSingleNode('./w:tcPr/w:shd/@w:fill',$n).Value -ne 'D9D9D9'){throw ('Merged gray section mismatch '+$s.id)}
    if($cells[0].InnerText -ne $wanted.title){throw ('Section text mismatch '+$s.id)}
   }else{
    if($cells.Count -ne 2){throw ('Not two Actor/System columns '+$s.id)}
    for($c=0;$c -lt 2;$c++){
     $text=($cells[$c].SelectNodes('.//w:t',$n)|ForEach-Object{$_.InnerText}) -join ''
     if($text -cne [string]$wanted.cells[$c]){throw ('Cell content mismatch '+$s.id+' row '+$r)}
    }
    if($wanted.kind -eq 'flow'){
     foreach($cell in $wanted.cells){if($cell){$stepNumber++;if(-not $cell.StartsWith($stepNumber.ToString()+'. ')){throw ('Step numbering mismatch '+$s.id)}}}
    }
   }
  }
 }
 $caps=@($x.SelectNodes('//w:body/w:p',$n)|ForEach-Object{($_.SelectNodes('.//w:t',$n)|ForEach-Object{$_.InnerText}) -join ''}|Where-Object{$_ -match '^Bảng 3\.\d+: Đặc tả use case '})
 if($caps.Count -ne 29){throw 'Caption count mismatch'}
 for($i=0;$i -lt 29;$i++){if($caps[$i] -notmatch ('^Bảng 3\.'+($i+3)+': ')){throw 'Caption numbering mismatch'}}
 $flowRows=($bundle.specs|ForEach-Object{$_.flow.Count}|Measure-Object -Sum).Sum
 return [pscustomobject]@{file=$file;tables=29;mainFlowRows=$flowRows;captionCount=$caps.Count;schema='5 metadata rows + merged gray sections + Actor/System';xmlValid=$true}
}
$validations=@((Validate-Tables $standalone),(Validate-Tables $integrated))
$written=Read-Document $integrated;$nn=[Xml.XmlNamespaceManager]::new($written.NameTable);$nn.AddNamespace('w',$w)
$actual=@($written.SelectSingleNode('//w:body',$nn).ChildNodes);$cursor=0;$preserved=0
for($i=0;$i -lt $nodes.Count;$i++){
 if($allowed.Contains($i)){continue}
 while($cursor -lt $actual.Count -and $actual[$cursor].OuterXml -cne $nodes[$i].OuterXml){$cursor++}
 if($cursor -eq $actual.Count){throw ('Original element lost '+$i)};$cursor++;$preserved++
}
$za=[IO.Compression.ZipFile]::OpenRead($source);$zb=[IO.Compression.ZipFile]::OpenRead($integrated);$preservedParts=0
try{
 if($za.Entries.Count -ne $zb.Entries.Count){throw 'Package part count mismatch'}
 foreach($e in $za.Entries){
  if($e.FullName -eq 'word/document.xml'){continue}
  $a=$e.Open();$b=$zb.GetEntry($e.FullName).Open();$sha=[Security.Cryptography.SHA256]::Create()
  try{if([BitConverter]::ToString($sha.ComputeHash($a)) -ne [BitConverter]::ToString($sha.ComputeHash($b))){throw ('Package part changed '+$e.FullName)}}finally{$a.Dispose();$b.Dispose();$sha.Dispose()};$preservedParts++
 }
}finally{$za.Dispose();$zb.Dispose()}
if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $sourceHash){throw 'Original report changed'}
foreach($p in $bundle.sources.PSObject.Properties){if((Get-FileHash -LiteralPath (Join-Path $repoRoot $p.Value.file) -Algorithm SHA256).Hash -ne $bundle.sourceHashes.($p.Name)){throw ('Source changed: '+$p.Value.file)}}
$result=[ordered]@{rewritten=28;added=1;total=29;validations=$validations;originalReportUnchanged=$true;originalHash=$sourceHash;originalBodyElementsPreserved=$preserved;unchangedPackageParts=$preservedParts;imagesPreserved=@($written.SelectNodes('//w:drawing|//w:pict',$nn)).Count;sourceFingerprintsVerified=@($bundle.sources.PSObject.Properties).Count;runtimeTestsRun=$false;wordVisualLayoutVerified=$false;documents=@($standalone,$integrated)}
$result | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'validation-29.json')
$result | ConvertTo-Json -Depth 4
