$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing
$drawingRoot=Join-Path (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path 'output/thesis-review-20261104'
$bitmap=[Drawing.Bitmap]::new(1800,1510)
$g=[Drawing.Graphics]::FromImage($bitmap)
$g.Clear([Drawing.Color]::White)
$g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$svg=[Collections.Generic.List[string]]::new()
$svg.Add('<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1510" viewBox="0 0 1800 1510"><rect width="1800" height="1510" fill="white"/><title>Sơ đồ use case SME — đề xuất thêm actor Doanh nghiệp và một use case lập và gửi đề nghị vay</title><desc>Bản vẽ đề xuất, chưa sửa báo cáo hay đặc tả. Cổng DN thuộc hệ thống; DN trực tiếp gửi đề nghị, CBTD tiếp nhận riêng. Đường liền biểu diễn tương tác, không biểu diễn thứ tự quy trình.</desc>')
function X([string]$v){[Security.SecurityElement]::Escape($v)}
function Draw-Line($points,[string]$color='#59616B',[float]$width=2){
 $pen=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml($color),$width)
 $coordinates=[Collections.Generic.List[string]]::new()
 for($i=0;$i -lt $points.Count;$i++){
  $coordinates.Add(($points[$i][0].ToString()+','+$points[$i][1].ToString()))
  if($i -gt 0){$g.DrawLine($pen,[float]$points[$i-1][0],[float]$points[$i-1][1],[float]$points[$i][0],[float]$points[$i][1])}
 }
 $svg.Add('<polyline points="'+($coordinates -join ' ')+'" fill="none" stroke="'+$color+'" stroke-width="'+$width+'"/>')
 $pen.Dispose()
}
function Draw-Text([string[]]$lines,[float]$cx,[float]$cy,[float]$size=24,[string]$color='#202830',[bool]$bold=$false){
 $style=if($bold){[Drawing.FontStyle]::Bold}else{[Drawing.FontStyle]::Regular}
 $font=[Drawing.Font]::new('Segoe UI',$size,$style,[Drawing.GraphicsUnit]::Pixel)
 $brush=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($color))
 $format=[Drawing.StringFormat]::new();$format.Alignment=[Drawing.StringAlignment]::Center;$format.LineAlignment=[Drawing.StringAlignment]::Center
 $leading=$size*1.35
 for($i=0;$i -lt $lines.Count;$i++){
  $lineY=$cy+($i-($lines.Count-1)/2)*$leading
  $g.DrawString($lines[$i],$font,$brush,[Drawing.PointF]::new($cx,$lineY),$format)
  $weight=if($bold){'600'}else{'400'}
  $svg.Add('<text x="'+$cx+'" y="'+$lineY+'" dominant-baseline="central" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="'+$size+'" font-weight="'+$weight+'" fill="'+$color+'">'+(X $lines[$i])+'</text>')
 }
 $font.Dispose();$brush.Dispose();$format.Dispose()
}
function Draw-Rect([float]$x,[float]$y,[float]$width,[float]$height,[string]$stroke='#59616B',[string]$fill='#FFFFFF',[bool]$dashed=$false){
 $pen=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml($stroke),2)
 if($dashed){$pen.DashStyle=[Drawing.Drawing2D.DashStyle]::Dash}
 $brush=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($fill))
 $g.FillRectangle($brush,$x,$y,$width,$height);$g.DrawRectangle($pen,$x,$y,$width,$height)
 $dash=if($dashed){' stroke-dasharray="8 7"'}else{''}
 $svg.Add('<rect x="'+$x+'" y="'+$y+'" width="'+$width+'" height="'+$height+'" fill="'+$fill+'" stroke="'+$stroke+'" stroke-width="2"'+$dash+'/>')
 $pen.Dispose();$brush.Dispose()
}
function Draw-UseCase([string]$id,[float]$cx,[float]$cy,[string[]]$lines,[float]$width=350,[float]$height=80,[bool]$isNew=$false){
 $stroke=if($isNew){'#146B91'}else{'#59616B'};$fill=if($isNew){'#EAF6FC'}else{'#FFFFFF'}
 $pen=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml($stroke),2)
 $brush=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($fill))
 $g.FillEllipse($brush,($cx-$width/2),($cy-$height/2),$width,$height)
 $g.DrawEllipse($pen,($cx-$width/2),($cy-$height/2),$width,$height)
 $svg.Add('<ellipse id="'+$id+'" cx="'+$cx+'" cy="'+$cy+'" rx="'+($width/2)+'" ry="'+($height/2)+'" fill="'+$fill+'" stroke="'+$stroke+'" stroke-width="2"/>')
 Draw-Text $lines $cx $cy 25 $stroke $isNew
 $pen.Dispose();$brush.Dispose()
}
function Draw-Actor([float]$cx,[float]$cy,[string[]]$label,[bool]$isNew=$false){
 $color=if($isNew){'#146B91'}else{'#303944'}
 $pen=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml($color),2.6)
 $g.DrawEllipse($pen,($cx-13),($cy-64),26,26)
 $svg.Add('<circle cx="'+$cx+'" cy="'+($cy-51)+'" r="13" fill="white" stroke="'+$color+'" stroke-width="2.6"/>')
 Draw-Line @(@($cx,($cy-38)),@($cx,($cy+9))) $color 2.6
 Draw-Line @(@(($cx-30),($cy-17)),@(($cx+30),($cy-17))) $color 2.6
 Draw-Line @(@(($cx-26),($cy+42)),@($cx,($cy+9)),@(($cx+26),($cy+42))) $color 2.6
 Draw-Text $label $cx ($cy+72) 24 $color $isNew
 $pen.Dispose()
}
Draw-Text @('SƠ ĐỒ USE CASE — ĐỀ XUẤT BỔ SUNG CỔNG DOANH NGHIỆP') 900 35 30 '#202830' $true
Draw-Rect 310 90 1180 1300
Draw-Text @('HỆ THỐNG QUẢN LÝ QUY TRÌNH XÉT DUYỆT HỒ SƠ VAY SME') 900 120 23 '#202830' $true
Draw-Rect 420 160 460 165 '#73A5BE' '#FFFFFF' $true
Draw-Text @('Cổng doanh nghiệp — phần bổ sung') 650 182 20 '#146B91' $true
Draw-Text @('Phân hệ cán bộ ngân hàng') 1185 282 22 '#687785' $true

# Associations are deliberately plain lines, with no workflow or include arrows.
Draw-Line @(@(150,218),@(245,218),@(475,245)) '#146B91' 2.8
foreach($y in @(370,480,590,700,810)){Draw-Line @(@(150,573),@(240,590),@(445,$y))}
Draw-Line @(@(1650,573),@(1540,590),@(1540,370),@(825,370))
foreach($y in @(480,700)){Draw-Line @(@(1650,573),@(1530,590),@(1370,$y))}
foreach($y in @(960,1070,1180)){Draw-Line @(@(150,1053),@(245,1070),@(445,$y))}
foreach($y in @(1030,1170)){Draw-Line @(@(1650,1083),@(1550,1100),@(1370,$y))}
# Internal authentication is linked separately to each internal actor.
Draw-Line @(@(150,573),@(215,590),@(215,1320),@(750,1320)) '#ADB5BE' 1.6
Draw-Line @(@(150,1053),@(235,1070),@(235,1300),@(760,1300)) '#ADB5BE' 1.6
Draw-Line @(@(1650,573),@(1590,590),@(1590,1320),@(1050,1320)) '#ADB5BE' 1.6
Draw-Line @(@(1650,1083),@(1570,1100),@(1570,1300),@(1040,1300)) '#ADB5BE' 1.6

Draw-UseCase 'dn-lap-gui' 650 245 @('Lập và gửi','đề nghị vay') 350 88 $true
Draw-UseCase 'tra-cuu' 635 370 @('Tra cứu hồ sơ vay') 380
Draw-UseCase 'tiep-nhan' 635 480 @('Tiếp nhận hồ sơ vay') 380
Draw-UseCase 'chung-tu' 635 590 @('Quản lý chứng từ') 380
Draw-UseCase 'to-trinh' 635 700 @('Lập tờ trình') 380
Draw-UseCase 'han-muc' 635 810 @('Xác định hạn mức') 380
Draw-UseCase 'tham-dinh' 1180 480 @('Thẩm định hồ sơ vay') 380
Draw-UseCase 'quyet-dinh' 1180 700 @('Quyết định tín dụng') 380
Draw-UseCase 'theo-doi' 635 960 @('Theo dõi hồ sơ') 380
Draw-UseCase 'dong-qua-han' 635 1070 @('Đóng hồ sơ quá hạn') 380
Draw-UseCase 'phan-cong' 635 1180 @('Phân công hồ sơ') 380
Draw-UseCase 'nguoi-dung' 1180 1030 @('Quản lý người dùng') 380
Draw-UseCase 'cau-hinh-sla' 1180 1170 @('Cấu hình SLA') 380
Draw-UseCase 'dang-nhap' 900 1320 @('Đăng nhập nội bộ') 300 76
Draw-Actor 120 235 @('Doanh nghiệp') $true
Draw-Actor 120 590 @('Cán bộ tín dụng')
Draw-Actor 120 1070 @('Quản lý','chi nhánh')
Draw-Actor 1680 590 @('Cán bộ','thẩm quyền')
Draw-Actor 1680 1100 @('Quản trị viên')
Draw-Text @('Màu xanh: 1 actor và 1 use case chính được đề xuất thêm. DN đăng nhập Portal trước khi lập/gửi.') 900 1430 22 '#146B91'
Draw-Text @('DN gửi đề nghị ≠ CBTD tiếp nhận thành hồ sơ vay. Đường liên kết không biểu diễn thứ tự xử lý.') 900 1468 22 '#59616B'
$svg.Add('</svg>')
$svgPath=Join-Path $drawingRoot 'Use_case_SME_bo_sung_cong_DN.svg'
$pngPath=Join-Path $drawingRoot 'Use_case_SME_bo_sung_cong_DN.png'
[IO.File]::WriteAllText($svgPath,($svg -join "`n"),[Text.UTF8Encoding]::new($false))
$bitmap.Save($pngPath,[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$bitmap.Dispose()
[xml]$verified=Get-Content -Raw -Encoding UTF8 $svgPath
$nsm=[Xml.XmlNamespaceManager]::new($verified.NameTable);$nsm.AddNamespace('s','http://www.w3.org/2000/svg')
if($verified.SelectNodes('//s:ellipse',$nsm).Count -ne 14){throw 'Expected 13 original groups plus 1 new enterprise use case'}
if($verified.SelectNodes('//s:circle',$nsm).Count -ne 5){throw 'Expected five actors'}
[pscustomobject]@{svg=$svgPath;png=$pngPath;actors=5;useCases=14;newEnterpriseUseCases=1;reportEdited=$false} | ConvertTo-Json
