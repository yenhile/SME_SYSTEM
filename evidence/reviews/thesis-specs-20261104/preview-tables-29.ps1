$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing
$data=Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'specifications-29.json')|ConvertFrom-Json
$regular=[Drawing.Font]::new('Times New Roman',21,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
$bold=[Drawing.Font]::new('Times New Roman',21,[Drawing.FontStyle]::Bold,[Drawing.GraphicsUnit]::Pixel)
$tmp=[Drawing.Bitmap]::new(10,10);$measure=[Drawing.Graphics]::FromImage($tmp)
$measure.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$format=[Drawing.StringFormat]::new();$format.Trimming=[Drawing.StringTrimming]::None
$format.FormatFlags=[Drawing.StringFormatFlags]::LineLimit
$center=[Drawing.StringFormat]::new();$center.Alignment=[Drawing.StringAlignment]::Center;$center.LineAlignment=[Drawing.StringAlignment]::Center
$colWidth=360;$pad=10;$left=30;$top=64
foreach($id in @('UC01','UC29')){
 $s=$data.specs|Where-Object{$_.id -eq $id};$rows=[Collections.ArrayList]::new();$height=$top
 foreach($r in $s.rows){
  if($r.kind -eq 'section'){$rowHeight=44}
  else{
   $heights=@();for($c=0;$c -lt 2;$c++){$font=if(($r.kind -eq 'meta' -and $c -eq 0)-or $r.kind -eq 'columns'){$bold}else{$regular};$size=$measure.MeasureString([string]$r.cells[$c],$font,[Drawing.SizeF]::new(($colWidth-$pad*2),10000),$format);$heights+=$size.Height}
   $rowHeight=[Math]::Max(43,[Math]::Ceiling(($heights|Measure-Object -Maximum).Maximum)+$pad*2)
  }
  [void]$rows.Add(@{row=$r;height=$rowHeight});$height+=$rowHeight
 }
 $bitmap=[Drawing.Bitmap]::new(($colWidth*2+$left*2),($height+30));$g=[Drawing.Graphics]::FromImage($bitmap);$g.Clear([Drawing.Color]::White)
 $g.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit;$g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $caption='Bảng 3.'+([int]$s.id.Substring(2)+2)+': Đặc tả use case '+$s.title
 $g.DrawString($caption,$regular,[Drawing.Brushes]::Black,[Drawing.RectangleF]::new($left,5,$colWidth*2,50),$center)
 $y=$top
 foreach($item in $rows){
  $r=$item.row;$h=$item.height
  if($r.kind -eq 'section'){
   $g.FillRectangle([Drawing.Brushes]::LightGray,$left,$y,$colWidth*2,$h);$g.DrawRectangle([Drawing.Pens]::Black,$left,$y,$colWidth*2,$h)
   $g.DrawString($r.title,$bold,[Drawing.Brushes]::Black,[Drawing.RectangleF]::new($left,$y,$colWidth*2,$h),$center)
  }else{
   for($c=0;$c -lt 2;$c++){
    $x=$left+$c*$colWidth;$font=if(($r.kind -eq 'meta' -and $c -eq 0)-or $r.kind -eq 'columns'){$bold}else{$regular}
    $fmt=if($r.kind -eq 'columns'){$center}else{$format}
    $g.DrawRectangle([Drawing.Pens]::Black,$x,$y,$colWidth,$h)
    $g.DrawString([string]$r.cells[$c],$font,[Drawing.Brushes]::Black,[Drawing.RectangleF]::new(($x+$pad),($y+$pad),($colWidth-$pad*2),($h-$pad*2)),$fmt)
   }
  };$y+=$h
 }
 $png=Join-Path $PSScriptRoot ('table-preview-'+$id+'.png');$bitmap.Save($png,[Drawing.Imaging.ImageFormat]::Png)
 $g.Dispose();$bitmap.Dispose();[pscustomobject]@{id=$id;rows=$rows.Count;width=($colWidth*2+$left*2);height=($height+30);file=$png;kind='Preview from same cell data; not a Microsoft Word page render'}|ConvertTo-Json -Compress
}
$measure.Dispose();$tmp.Dispose();$regular.Dispose();$bold.Dispose();$format.Dispose();$center.Dispose()
