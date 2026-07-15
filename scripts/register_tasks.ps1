# 개별인정아카이브 - 작업 스케줄러 자동 등록 스크립트
# 이 스크립트는 어느 PC에서 실행해도 자기 위치(scripts 폴더)를 기준으로 경로를 자동 계산합니다.

$ErrorActionPreference = "Stop"

# scripts 폴더의 상위 폴더 = 개별인정아카이브 루트
$root = (Resolve-Path "$PSScriptRoot\..").Path

Write-Host "대상 폴더: $root"

# python.exe 자동 탐색
$pyCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCmd) {
    $pyCmd = Get-Command py -ErrorAction SilentlyContinue
}
if (-not $pyCmd) {
    Write-Host ""
    Write-Host "[오류] Python을 찾을 수 없습니다. Python을 설치한 뒤 다시 실행해주세요." -ForegroundColor Red
    Write-Host "       (설치 시 'Add python.exe to PATH' 옵션을 꼭 체크하세요)" -ForegroundColor Red
    exit 1
}
$py = $pyCmd.Source
Write-Host "Python 경로: $py"
Write-Host ""

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

$tasks = @(
    @{ Name = "HealthArchive_IngredientUpdate";          Script = "update_ingredients.py";             Times = @("09:00am") },
    @{ Name = "HealthArchive_MinutesUpdate";             Script = "update_minutes.py";                 Times = @("09:10am") },
    @{ Name = "HealthArchive_ProductUpdate";             Script = "update_products.py";                Times = @("09:30am") },
    @{ Name = "HealthArchive_PaperReportUpdate";         Script = "update_paper_reports.py";           Times = @("09:40am") },

    @{ Name = "HealthArchive_News_Foodnews";             Script = "update_news.py";                    Times = @("09:30am", "05:30pm") },
    @{ Name = "HealthArchive_News_KFRI";                 Script = "update_news_kfri.py";               Times = @("09:30am", "05:30pm") },
    @{ Name = "HealthArchive_News_MFDS";                 Script = "update_news_mfds.py";               Times = @("09:30am", "05:30pm") },
    @{ Name = "HealthArchive_News_NutraIngredients";     Script = "update_news_nutraingredients.py";   Times = @("09:30am", "05:30pm") },
    @{ Name = "HealthArchive_News_SupplySideSJ";         Script = "update_news_supplysidesj.py";       Times = @("09:30am", "05:30pm") },
    @{ Name = "HealthArchive_News_NutritionInsight";     Script = "update_news_nutritioninsight.py";   Times = @("09:30am", "05:30pm") }
)

$legacyTasks = @(
    "HealthArchive_NewsUpdate",
    "HealthArchive_YakupNewsUpdate",
    "HealthArchive_ScienceDailyNewsUpdate",
    "HealthArchive_ThinkfoodNewsUpdate",
    "HealthArchive_News_Thinkfood",
    "HealthArchive_ProductsUpdate",
    "HealthArchive_PaperReportsUpdate"
)

foreach ($name in $legacyTasks) {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
        Write-Host "기존 작업 제거: $name"
    }
}

foreach ($t in $tasks) {
    $scriptPath = Join-Path $root "scripts\$($t.Script)"
    $action = New-ScheduledTaskAction -Execute $py -Argument "`"$scriptPath`"" -WorkingDirectory $root
    $triggers = @()
    foreach ($time in $t.Times) {
        $triggers += New-ScheduledTaskTrigger -Daily -At $time
    }
    Register-ScheduledTask -TaskName $t.Name -Action $action -Trigger $triggers -Settings $settings -Force | Out-Null
    Write-Host "등록 완료: $($t.Name)  (매일 $($t.Times -join ', '))"
}

Write-Host ""
Write-Host "작업 등록이 완료되었습니다. 뉴스 6개 소스는 매일 09:30 / 17:30, 1일 2회 실행됩니다." -ForegroundColor Green
