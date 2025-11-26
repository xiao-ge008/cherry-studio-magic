Write-Host "Cherry Studio - Port 23333 Cleanup Tool"
Write-Host "========================================"
Write-Host ""

$connections = Get-NetTCPConnection -LocalPort 23333 -ErrorAction SilentlyContinue

if ($connections) {
    foreach ($conn in $connections) {
        $processId = $conn.OwningProcess
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

        if ($process) {
            Write-Host "Found process using port 23333:"
            Write-Host "  Process ID: $processId"
            Write-Host "  Process Name: $($process.ProcessName)"
            Write-Host ""

            $confirm = Read-Host "Kill this process? (Y/N)"
            if ($confirm -eq "Y" -or $confirm -eq "y") {
                try {
                    Stop-Process -Id $processId -Force
                    Write-Host "Process killed successfully" -ForegroundColor Green
                }
                catch {
                    Write-Host "Failed to kill process: $_" -ForegroundColor Red
                }
            }
        }
    }
}
else {
    Write-Host "Port 23333 is not in use" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done!"
